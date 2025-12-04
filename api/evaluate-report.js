// api/evaluate-report.js
// Care Report AI - evaluate-report.js (Vercel serverless)

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ------------ 共通ヘルパー ------------

function safeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
}

async function callOpenAI(messages) {
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages,
  });
  const content = resp.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI からの応答が取得できませんでした。");
  return content;
}

function extractScore(text) {
  const m = text.match(/スコア[:：]\s*(\d{1,3})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function extractSection(text, fromLabel, toLabel) {
  const fromIdx = text.indexOf(fromLabel);
  if (fromIdx === -1) return "";
  const start = fromIdx + fromLabel.length;
  const rest = text.slice(start);
  if (!toLabel) return rest.trim();
  const toIdx = rest.indexOf(toLabel);
  if (toIdx === -1) return rest.trim();
  return rest.slice(0, toIdx).trim();
}

// ------------ ハンドラ本体 ------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = safeBody(req);

  const flow = body.flow || "fullEvaluate";
  const mode = body.mode || "report";

  // 既存フロントとの互換性のために、basicInfo / vital の別名も拾う
  const basicInfoText =
    body.basicInfoText ||
    body.basicInfo ||
    body.basicInfoSummary ||
    body.basic ||
    "";

  const vitalText =
    body.vitalText ||
    body.vitals ||
    body.vitalSummary ||
    body.vital ||
    "";

  const seedText = body.seedText || "";
  const reportText = body.reportText || "";
  const localScore = body.localScore ?? null;
  const missingRequired = body.missingRequired || [];
  const missingOptional = body.missingOptional || [];
  const dialogueQA = Array.isArray(body.dialogueQA) ? body.dialogueQA : [];

  try {
    // ------------------------------------------------
    // 1) 質問生成フロー generateQuestions
    // ------------------------------------------------
    if (flow === "generateQuestions") {
      const systemForQuestions = `
あなたは日本の介護現場で使う「質問設計AIコーチ」です。

【受け取る情報】
- seedText: 職員が書いた「いま起きていること（1〜2行）」です。
- basicInfoText: 作成者名・対象者名・日時・場所などの基本情報です。
- vitalText: 体温・血圧・脈拍・SpO2 などのバイタルです。

【絶対ルール】

1. basicInfoText に「日時」「場所」「対象者」が含まれている場合、
   原則として「いつ・どこで・誰に起きたか」を確認する質問は作らないでください。
   これらは既に分かっている前提で話を進めます。

2. seedText と basicInfoText にまったく日時・場所・対象者が無い場合だけ、
   最初の 1問目に限り「いつ・どこで・誰に」をまとめて確認しても構いません。

3. 質問は 3〜7問程度。
   - seedText が具体的なら少なめ
   - seedText があいまいなら、抜けている重要情報だけを補う

4. すでに basicInfoText や vitalText に書いてある内容を、
   言い回しだけ変えて繰り返し質問しないこと。
   どうしても確認したい場合は「普段との違い」「変化の程度」に焦点を当ててください。

5. 各質問には、現場職員の学びになるように
   「POINT：〜〜〜」という形で「なぜその質問が大事か」を必ず付けてください。

6. 出力は必ず次の JSON 形式のみとし、日本語の文章は含めないこと。

{
  "questions": [
    { "question": "質問文", "point": "POINT の解説" },
    ...
  ]
}
`;

      const userForQuestions = `
【seedText】
${seedText || "（記載なし）"}

【basicInfoText】
${basicInfoText || "（記載なし）"}

【vitalText】
${vitalText || "（記載なし）"}

このケースで報告の質を上げるために本当に必要な質問を 3〜7 個作成し、
指定した JSON 形式で返してください。
`;

      const raw = await callOpenAI([
        { role: "system", content: systemForQuestions },
        { role: "user", content: userForQuestions },
      ]);

      let questions = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.questions)) {
          questions = parsed.questions.map((q) => ({
            question: String(q.question || "").trim(),
            point: String(q.point || "").trim(),
          }));
        }
      } catch {
        // JSON で返ってこなかった時の保険：行ごとパース
        const lines = raw
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const [q, p] = line.split("POINT：");
          if (!q) continue;
          questions.push({
            question: q.replace(/^[-・0-9.①-⑩]+/, "").trim(),
            point: (p || "").trim(),
          });
        }
      }

      if (!questions.length) {
        throw new Error("質問を生成できませんでした。入力内容を見直してください。");
      }

      return res.status(200).json({ questions });
    }

    // ------------------------------------------------
    // 共通：buildReport / fullEvaluate で使う評価プロンプト
    // ------------------------------------------------
    const modeLabel = mode === "instruction" ? "指示モード" : "共有・報告モード";

    const systemForEval = `
あなたは日本の介護施設・訪問介護における
「報告コーチ兼リスクマネジメント担当」です。

【役割】
- 職員が入力した情報をもとに、
  施設内共有に使える報告文・申し送り用 3 行要約・
  重要ポイント・医師向け要約を作成します。
- fullEvaluate フローでは、加えて管理者目線のフィードバック全文とスコアも返します。

【安全上の絶対ルール】

1. 事実と提案を混ぜないこと。
   - 実際に行ったか分からない対応（冷却、受診、薬の投与、バイタル測定など）を
     「実施した」と書いてはいけません。
   - 職員が「実施した」と明確に書いている内容だけを
     「実施した対応」として扱ってください。

2. 職員が「まだ何もしていない」「様子見のみ」と書いている場合、
   「実施した対応」の欄には
   「特に実施した対応はありません（未実施）。」などと明記してください。

3. 必要だと思う対応（医師への報告、受診、冷却など）は、
   「今後の観察・対応の検討事項」または
   「重要ポイント（観察・対応のために）」に
   提案の形で書いてください。
   決して「行いました」「実施しました」と書いてはいけません。

4. 不足している情報は、勝手に補わず「情報不足」「記載なし」として扱ってください。

【fullEvaluate フローでの出力フォーマット】

① 総評（全体の評価・リスクの有無）

② 曖昧表現の指摘と改善案

③ 不足している情報

④ 管理者・看護師として追加で確認したい点（質問リスト）

⑤ 整理された施設内共有向けの文章（見出し付き）
   ※ここでは事実のみ。提案は含めない。

⑥ 夜勤・申し送り用の 3 行要約

⑦ 重要ポイント（観察・対応のために）
   - 観察すべきポイント
   - 危険サイン（Red flag）
   - 誰に・どのタイミングで報告すべきか  など

⑧ 医師へ報告する時に使える要約（5〜8 行程度）
   - 利用者の基本情報（イニシャル・部屋番号程度）
   - 主訴（何のために報告するのか）
   - 経過の要点
   - バイタルの要点
   - 現在の状態
   - 医師に確認したいこと

最後に「スコア：85」のように 1〜100 点で総合スコアを付けてください。

【buildReport フローでの出力】
- 上記のうち ⑤〜⑧ のみを作成してください。
- ①〜④ は書かなくて構いません。
`;

    // buildReport / fullEvaluate 共通で渡す「材料」
    const qaText =
      dialogueQA.length > 0
        ? dialogueQA
            .map((item, idx) => {
              const q = (item.question || "").trim();
              const a = (item.answer || "").trim();
              return `Q${idx + 1}：${q}\nA${idx + 1}：${a}`;
            })
            .join("\n\n")
        : "（Q&A ログなし）";

    const userCommon = `
【モード】${modeLabel}

【基本情報】
${basicInfoText || "（記載なし）"}

【バイタル】
${vitalText || "（記載なし）"}

【いま起きていること（seedText）】
${seedText || "（記載なし）"}

【職員がまとめた報告文（reportText）】
${reportText || "（まだ作成されていない）"}

【Q&A ログ】
${qaText}
`;

    // ------------------------------------------------
    // 2) buildReport フロー：⑤〜⑧ だけ欲しい
    // ------------------------------------------------
    if (flow === "buildReport") {
      const userForBuild = `
【依頼内容】
上記の情報をもとに、⑤〜⑧ の部分だけを作成してください。
①〜④は書かなくて構いません。

必ず ⑤〜⑧ をこの順番で出力してください。
`;

      const full = await callOpenAI([
        { role: "system", content: systemForEval },
        { role: "user", content: userCommon + userForBuild },
      ]);

      // ここでは ⑤〜⑧ だけ出てくる想定だが、安全のためラベルで区切る
      const facilityText = extractSection(full, "⑤", "⑥") || full.trim();
      const shortSummary = extractSection(full, "⑥", "⑦");
      const trainingPoints = extractSection(full, "⑦", "⑧");
      const doctorSummary = extractSection(full, "⑧", null);

      return res.status(200).json({
        facilityText: facilityText.trim(),
        shortSummary: shortSummary.trim(),
        trainingPoints: trainingPoints.trim(),
        doctorSummary: doctorSummary.trim(),
      });
    }

    // ------------------------------------------------
    // 3) fullEvaluate フロー：①〜⑧＋スコア
    // ------------------------------------------------
    const userForEval = `
【ローカルスコア】
${localScore != null ? `${localScore} 点` : "（スコア情報なし）"}

【不足している可能性がある項目（フロント側チェック）】
必須：${
      Array.isArray(missingRequired) && missingRequired.length
        ? missingRequired.join("、")
        : "特になし"
    }
任意：${
      Array.isArray(missingOptional) && missingOptional.length
        ? missingOptional.join("、")
        : "特になし"
    }

上記を踏まえ、①〜⑧ まですべて作成してください。
`;

    const fullText = await callOpenAI([
      { role: "system", content: systemForEval },
      { role: "user", content: userCommon + userForEval },
    ]);

    const aiScore = extractScore(fullText);
    const facilityText = extractSection(fullText, "⑤", "⑥");
    const shortSummary = extractSection(fullText, "⑥", "⑦");
    const trainingPoints = extractSection(fullText, "⑦", "⑧");
    const doctorSummary = extractSection(fullText, "⑧", null);

    return res.status(200).json({
      aiScore,
      feedbackText: fullText.trim(),
      facilityText: (facilityText || "").trim(),
      shortSummary: (shortSummary || "").trim(),
      trainingPoints: (trainingPoints || "").trim(),
      doctorSummary: (doctorSummary || "").trim(),
    });
  } catch (err) {
    console.error("evaluate-report error:", err);
    return res.status(500).json({
      error:
        err?.message ||
        "サーバ側でエラーが発生しました。時間をおいて再度お試しください。",
    });
  }
}
