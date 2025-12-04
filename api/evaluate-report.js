// api/evaluate-report.js
// 介護報告・指示文の AI 支援機能 API（Vercel サーバレス）
// フロー：
//   flow === "generateQuestions" : AIヒアリング用の質問リストを生成
//   flow === "buildReport"       : Q&Aログから施設内共有向け文章を生成
//   flow === "fullEvaluate"      : 最終報告を管理者目線で評価＆整形

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 共通ヘルパー：安全に body を読む
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

// 共通ヘルパー：OpenAI 呼び出し
async function callOpenAI(messages) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages,
  });

  const choice = response.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error("AI からの応答を取得できませんでした。");
  }
  return content;
}

// 共通ヘルパー：スコア抽出（「スコア：85」形式）
function extractScore(fullText) {
  const m = fullText.match(/スコア[:：]\s*(\d{1,3})/);
  if (!m) return null;
  const raw = parseInt(m[1], 10);
  if (Number.isNaN(raw)) return null;
  return Math.max(0, Math.min(100, raw));
}

// 共通ヘルパー：セクション抜き出し（例：「⑤」「⑥」など）
function extractSection(fullText, fromLabel, toLabel) {
  const fromIdx = fullText.indexOf(fromLabel);
  if (fromIdx === -1) return "";
  const start = fromIdx + fromLabel.length;
  const sliced = fullText.slice(start);
  if (!toLabel) return sliced.trim();
  const toIdx = sliced.indexOf(toLabel);
  if (toIdx === -1) return sliced.trim();
  return sliced.slice(0, toIdx).trim();
}

export default async function handler(req, res) {
  // --------------------------------------------
  // Method check
  // --------------------------------------------
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // --------------------------------------------
  // Receive payload
  // --------------------------------------------
  const body = safeBody(req);

  const {
    flow = "fullEvaluate",
    mode = "report", // "report" | "instruction" だが、評価ロジックでは主にラベル用途
    reportText = "",
    localScore = null,
    missingRequired = [],
    missingOptional = [],
    seedText = "",
    basicInfoText = "",
    vitalText = "",
    dialogueQA = [],
  } = body;

  try {
    // ------------------------------------------
    // 1) 質問生成フロー：generateQuestions
    // ------------------------------------------
    if (flow === "generateQuestions") {
      const systemForQuestions = `
あなたは日本の介護現場で使う「質問設計AIコーチ」です。

【あなたが受け取る情報】
- seedText: 職員が書いた「いま起きていること（1〜2行）」です。
- basicInfoText: 作成者名・対象者名・日時・場所など、報告の基本情報です。
- vitalText: 体温・血圧・脈拍・SpO2 などのバイタルです。

【絶対ルール】

1. basicInfoText に「日時」「場所」「対象者」が入っている場合、
   原則として「いつ・どこで・誰に起きたか」を確認する質問は作らないでください。
   これらはすでに分かっている前提で話を進めます。

2. seedText や basicInfoText にまったく日時・場所・対象者の情報が無い場合に限り、
   最初の1問目だけ「いつ・どこで・誰に」のまとめ質問をしても構いません。

3. 最初の質問では、
   そのケースで最も重要な
   「何が起きたか」「どの程度か」「今困っていることは何か」
   といった中身の部分を具体化することを優先してください。
   形式的な確認質問（5W1Hの丸暗記のような質問）は避けてください。

4. すでに basicInfoText や vitalText に書かれている情報を、
   言い方だけ変えて繰り返し質問しないでください。
   同じ内容を質問する場合は、「変化」「普段との違い」「経過」にフォーカスします。

5. 質問は 3〜7問程度。
   - seedText が具体的であれば質問数を少なめに
   - seedText があいまい・情報不足であれば、抜けている重要情報だけを補う質問を追加
   するようにしてください。

6. 各質問には、現場職員の学びになるように
   「POINT：〜〜〜〜〜」という形で、
   なぜその質問が大事なのかの解説も付けてください。

7. 出力は必ず JSON 形式で行ってください。
   フォーマットは以下の通りです：

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

上記の情報をもとに、このケースで「報告の質を上げるために本当に必要な質問」を
3〜7個、日本語で作成してください。
出力は必ず JSON のみとし、余計な文章は書かないでください。
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
      } catch (e) {
        // JSON で返ってこなかった場合の保険：行ごとにパース
        const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
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

      return res.status(200).json({ ok: true, questions });
    }

    // ------------------------------------------
    // 2) 報告文生成フロー：buildReport
    // ------------------------------------------
    if (flow === "buildReport") {
      const systemForReport = `
あなたは日本の介護施設・訪問介護で使う「報告文作成AI」です。

【役割】
- 職員が入力した基本情報（対象者、日時、場所）とバイタル、
  そして AI ヒアリングで得られた Q&A ログをもとに、
  施設内共有に使える「事実ベースの報告文」を作成します。

【絶対ルール（安全上、最重要）】

1. 実際に行ったかどうか分からない対応（冷却、受診、薬の投与など）を、
   「実施した」として書いてはいけません。
   職員が「行った」と明確に答えている場合以外は、
   対応について推測しないでください。

2. Q&A ログの中で職員が
   「まだ何もしていない」「様子見しているだけ」などと答えている場合、
   報告文の中では
   「現時点で特別な対応は実施していません（観察継続）」など、
   事実として「未実施」であることを明記してください。

3. 必要だと思う対応（医師への報告、冷却、バイタル再測定など）は、
   「今後の観察・対応の検討事項」として
   提案の形で書いてください。
   決して「実施済み」として記載してはいけません。

【出力の構成】

以下の章立てで、日本語の報告文を作成してください。

■ 概要
（何が起きたかを 2〜3 文で簡潔に）

■ 基本情報
- 作成者：
- 対象者：
- 日時：
- 場所：
- バイタル： （分かる範囲で。なければ「記載なし」）

■ 経過
（いつ、どこで、どのような様子だったか。Q&Aから事実のみを整理）

■ 現時点の状態
（いまの様子・リスク・気になる点）

■ 実施した対応
（職員が行ったと明言している対応のみ。なければ「特に実施した対応はありません（未実施）」など）

■ 今後の観察・対応の検討事項
（ここではじめて、AIとしての提案を書いてよい）
`;

      const qaText =
        Array.isArray(dialogueQA) && dialogueQA.length
          ? dialogueQA
              .map((item, idx) => {
                const q = (item.question || "").trim();
                const a = (item.answer || "").trim();
                return `Q${idx + 1}：${q}\nA${idx + 1}：${a}`;
              })
              .join("\n\n")
          : "（Q&A ログなし）";

      const userForReport = `
【基本情報】
${basicInfoText || "（記載なし）"}

【バイタル】
${vitalText || "（記載なし）"}

【Q&Aログ】
${qaText}

上記の情報をもとに、施設内共有向けの報告文を作成してください。
`;

      const report = await callOpenAI([
        { role: "system", content: systemForReport },
        { role: "user", content: userForReport },
      ]);

      return res.status(200).json({
        ok: true,
        reportText: report.trim(),
      });
    }

    // ------------------------------------------
    // 3) 評価＆フィードバック：fullEvaluate
    // ------------------------------------------
    const modeLabel = mode === "instruction" ? "指示モード" : "共有・報告モード";

    const systemForEval = `
あなたは日本の介護施設・訪問介護における
「報告コーチ兼、リスクマネジメント担当」です。

現場職員が作成した報告文を読み、

- 施設内共有に使える「整理された報告文」
- 管理者・看護師向けのフィードバック
- 夜勤・申し送り用の 3 行要約
- 重要ポイント（観察・対応の視点）
- 医師へ電話報告するときに使える要約

を作成します。

【絶対に守るルール（安全上、最重要）】

1. 事実と提案を絶対に混ぜないこと。

2. 「実施した対応」は、元の報告文の「実施した対応」「行った対応」に書かれている内容だけを要約してください。
   元の報告文に書かれていない対応（例：冷却、受診、薬の投与、バイタル測定など）を、
   実際に行ったかのように書いてはいけません。

3. 職員が「特に何もしていない」「まだ対応していない」と書いている場合、
   「実施した対応」の欄には
   「特に実施した対応はありません（未実施）」などと明記してください。

4. 必要だと思う対応があっても、それは必ず
   「今後推奨される対応」「管理者・看護師への相談が望ましい」などの
   “提案” として別枠で書いてください。
   決して「行いました」「実施しました」と書いてはいけません。

5. 不足している情報は、勝手に補わず「情報不足」「記載なし」として扱ってください。

【出力フォーマット】

以下の 8 セクションで出力してください。

① 総評（全体の評価・リスクの有無）

② 曖昧表現の指摘と改善案
   （「ぐったり」「元気がない」などを、どのような表現に変えるとよいか）

③ 不足している情報
   （何が書かれていないと判断したか）

④ 管理者・看護師として追加で確認したい点（質問リスト）

⑤ 整理された施設内共有向けの文章（見出し付き）
   ※ ここでは事実のみ。AI の提案は混ぜない。

⑥ 夜勤・申し送り用の 3 行要約

⑦ 重要ポイント（観察・対応のために）
   - 観察すべきポイント
   - 危険サイン（Red flag）
   - 誰に・どのタイミングで報告すべきか

⑧ 医師へ報告する時に使える要約（5〜8 行程度）
   - 利用者の基本情報（イニシャル・部屋番号程度）
   - 主訴（何のために報告するのか）
   - 経過の要点
   - バイタルの要点
   - 現在の状態
   - 医師に確認したいこと

最後に「スコア：85」のように 1〜100 点で総合スコアを付けてください。
`;

    const userForEval = `
【モード】${modeLabel}

【ローカルスコア】
${localScore != null ? `${localScore} 点` : "（スコア情報なし）"}

【不足している可能性がある項目（フロント側チェック）】
必須：${Array.isArray(missingRequired) && missingRequired.length ? missingRequired.join("、") : "特になし"}
任意：${Array.isArray(missingOptional) && missingOptional.length ? missingOptional.join("、") : "特になし"}

【職員が作成した報告文】
${reportText}
`;

    const fullText = await callOpenAI([
      { role: "system", content: systemForEval },
      { role: "user", content: userForEval },
    ]);

    const aiScore = extractScore(fullText);

    // ⑤〜⑧ をざっくり抽出して、フロントで使いやすく返す
    const facilityText = extractSection(fullText, "⑤", "⑥");
    const shortSummary = extractSection(fullText, "⑥", "⑦");
    const trainingPoints = extractSection(fullText, "⑦", "⑧");
    const doctorSummary = extractSection(fullText, "⑧", "スコア");

    return res.status(200).json({
      ok: true,
      aiScore,
      feedbackText: fullText.trim(), // 黒いフィードバック欄用（全文）
      facilityText: facilityText || "",
      shortSummary: shortSummary || "",
      trainingPoints: trainingPoints || "",
      doctorSummary: doctorSummary || "",
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
