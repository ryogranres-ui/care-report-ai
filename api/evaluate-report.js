// Care Report AI - evaluate-report.js（Vercel serverless）

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = req.body || {};
    const {
      flow,
      mode,
      seedText,
      userName,
      vitalText,
      qaLog,
      basicInfo,
      reportText,
      localScore,
      includeEducation,
    } = body;

    const modeLabel =
      mode === "instruction" ? "指示モード" : "共有・報告モード";

    // ---------- ① generateQuestions ----------
    if (flow === "generateQuestions") {
      if (!seedText || !mode) {
        return res.status(400).json({
          error: "generateQuestions には mode と seedText が必要です。",
        });
      }

      const systemPrompt = `
あなたは介護施設の「看護師長 兼 管理者」です。
職員から短い状況説明を聞き、その内容をもとに
必要な情報を漏れなく集めるための「質問リスト」を作成します。

【目的】
- 報告に必要な事実をもれなく聞き出す
- 新人〜ベテランまで、誰が答えても「プロ品質」の報告になるよう導く
- 各質問に「なぜそれを聞くのか（POINT）」も添えて学びにする

【バイタルについて】
- すでに「体温」「血圧」「脈拍」「SpO2」などが報告されている場合、
  同じ内容を重ねて聞かないこと。
- ただし、バイタルの「変化」や「普段との比較」が重要な場合は、
  その観点から質問してよい。

【出力形式】
下記の JSON だけを出力してください。

{
  "questions": [
    { "question": "質問文", "point": "この質問で何を確認したいか（重要ポイント・新人にも分かる解説）" }
  ]
}

ルール：
- 質問は3〜7個
- 現場職員が答えやすい自然な日本語
- POINT は1〜2文で簡潔に
- 医療的な危険サインが疑われる場合は、観察すべきポイントも意識して質問を組み立てる
      `.trim();

      const userPrompt = `
【モード】${modeLabel}
【対象利用者】${userName || "（未記入）"}
【現在分かっているバイタル】${vitalText || "（未記入）"}

【職員からの状況説明】
${seedText}

上記をもとに、質問リストを JSON 形式で作成してください。
      `.trim();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "";
      let questions = [];

      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.questions)) {
          questions = parsed.questions
            .map((q) => ({
              question: String(q.question || "").trim(),
              point: String(q.point || "").trim(),
            }))
            .filter((q) => q.question.length > 0);
        }
      } catch (e) {
        const lines = raw
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const m = line.match(/Q\d*[:：]\s*(.+)/);
          if (m) {
            questions.push({ question: m[1].trim(), point: "" });
          }
        }
      }

      if (!questions.length) {
        questions = [
          {
            question:
              "まず、いつ・どこで・誰に起きた出来事かを教えてください。",
            point:
              "報告の基本である「いつ・どこで・誰に」は、最初に必ず押さえておきたい情報です。",
          },
        ];
      }

      return res.status(200).json({ questions });
    }

    // ---------- ② buildReport ----------
    if (flow === "buildReport") {
      if (!qaLog || !Array.isArray(qaLog) || qaLog.length === 0) {
        return res.status(400).json({
          error: "buildReport には qaLog（Q&Aの配列）が必要です。",
        });
      }

      const systemPrompt = `
あなたは介護施設の「看護師長 兼 管理者」です。
現場職員との Q&A と基本情報をもとに、施設内共有向けの報告文を作成します。

【目的】
- 誰が・いつ・どこで・何をしているときに・どうなったか を分かりやすく整理
- 安全面・再発防止の観点で重要な事実は落とさない
- 医療的に重要な情報（症状の組み合わせ、経過、バイタルの変化）は必ず含める
- 箇条書きではなく、文章として読める形にまとめる
- 不明な点は「情報不足」と記載し、勝手に補わない
- 「■ 概要」「■ 基本情報」「■ 経過」「■ 実施した対応」「■ 今後の観察・報告ライン」を基本構成とする
      `.trim();

      const basic = basicInfo || {};
      const qaText = (qaLog || [])
        .map(
          (item, idx) =>
            `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`
        )
        .join("\n\n");

      const userPrompt = `
【モード】${modeLabel}

【基本情報】
- 作成者：${basic.reporterName || "（未記入）"}
- 対象者：${basic.userName || "（未記入）"}
- 日時：${basic.eventDateTime || "（未記入）"}
- 場所：${basic.eventPlace || "（未記入）"}
- バイタル：${basic.vitalText || "（未記入）"}

【職員とのQ&A】
${qaText}

上記をもとに、施設内共有向けの報告文を1本作成してください。
      `.trim();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const text = completion.choices?.[0]?.message?.content || "";
      return res.status(200).json({ reportText: text.trim() });
    }

    // ---------- ③ fullEvaluate ----------
    if (!reportText || !mode) {
      return res.status(400).json({
        error: "fullEvaluate には mode と reportText が必要です。",
      });
    }

    const systemPrompt = `
あなたは介護施設の「看護師長 兼 管理者」として、
現場職員の報告力・判断力・ケアの質を育てるAIメンターです。

【基本ルール】
- 曖昧表現は必ず指摘し、客観的で医療・介護専門職に伝わりやすい表現に言い換える
- 不足情報は「情報不足」と明記し、推測で補わない
- 職員を責めず、次につながるフィードバックにする
- 構成の整理・重複削除・時系列整理も行う
- 医療的な危険サイン（Red Flag）が疑われる場合は、その理由と観察のポイントを示す

【視点】
- 介護職員が現場で何を観察すべきか
- 管理者が安全管理・再発防止の観点で気にすべき点
- 医師に報告する際に不足しやすい情報
    `.trim();

    const userPrompt = `
【モード】${modeLabel}
【ローカルスコア】${localScore ?? "（未計算）"} 点

【職員が作成した文章】
---
${reportText}
---

【出力フォーマット】
① 総評（1〜3行）
② 曖昧表現の指摘と改善案
③ 不足している情報
④ 管理者として追加で確認したい点（質問リスト）
⑤ 専門的な書き直し例（全文）
⑥ 夜勤・申し送り用の3行要約
${
  includeEducation
    ? `⑦ 重要ポイント（観察・対応のためのまとめ）`
    : ""
}
⑧ 医師へ報告する時に使えるまとめ（医療機関向け）
   - 受診相談や電話報告で、そのまま読み上げて使えることを目標にする
   - 以下の順番で5〜8行の箇条書きにまとめる
     1) 利用者の基本情報（氏名・年齢・性別・施設名）
     2) 主訴と経過（いつから・どのように変化したか）
     3) バイタルと主要な身体所見
     4) これまで施設側で行った対応
     5) 医師に確認したいこと・指示をもらいたいこと
     6) 緊急度の判断に関わる情報（呼吸苦・意識・摂食量の低下など）

最後に「スコア：85」のように 0〜100 の総合点を1つだけ示してください。

さらに、回答の末尾に次の形式で3行要約だけを再掲してください：

<<SHORT>>
（ここに3行要約のみ）
<<END_SHORT>>

${
  includeEducation
    ? `
そして、「重要ポイント（観察・対応のためのまとめ）」の内容だけを次の形式で再掲してください：

<<EDU>>
（ここに重要ポイントのみ）
<<END_EDU>>`
    : ""
}

最後に、「医師へ報告する時に使えるまとめ（医療機関向け）」の内容だけを
次の形式で再掲してください。
各項目は1〜2文で、5〜8行程度の箇条書きにしてください。

<<DOCTOR>>
（ここに医師向けのまとめのみ）
<<END_DOCTOR>>
    `.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const full = completion.choices?.[0]?.message?.content || "";

    // スコア抽出
    const scoreMatch = full.match(/スコア[:：]\s*(\d{1,3})/);
    const aiScore = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : null;

    // SHORT抽出
    let shortText = "";
    const shortMatch = full.match(/<<SHORT>>([\s\S]*?)<<END_SHORT>>/);
    if (shortMatch) shortText = shortMatch[1].trim();

    // EDU抽出
    let eduText = "";
    if (includeEducation) {
      const eduMatch = full.match(/<<EDU>>([\s\S]*?)<<END_EDU>>/);
      if (eduMatch) eduText = eduMatch[1].trim();
    }

    // DOCTOR抽出
    let doctorText = "";
    const doctorMatch = full.match(/<<DOCTOR>>([\s\S]*?)<<END_DOCTOR>>/);
    if (doctorMatch) doctorText = doctorMatch[1].trim();

    // SHORT / EDU / DOCTOR を除外
    let feedbackText = full
      .replace(/<<SHORT>>[\s\S]*?<<END_SHORT>>/, "")
      .replace(/<<EDU>>[\s\S]*?<<END_EDU>>/, "")
      .replace(/<<DOCTOR>>[\s\S]*?<<END_DOCTOR>>/, "")
      .trim();

    // ⑥以降（3行要約・重要ポイント・医師向け）はフィードバックからカット
    feedbackText = feedbackText.split(/\n+⑥/)[0].trim();

    // ⑤ 専門的な書き直し例 だけを抽出
    let rewriteText = "";
    const rewriteMatch = feedbackText.match(/⑤[^\n]*\n([\s\S]*)/);
    if (rewriteMatch) {
      rewriteText = rewriteMatch[1].trim();
      // フィードバック本文から⑤以降を削除（①〜④だけ残す）
      feedbackText = feedbackText.split(/\n+⑤/)[0].trim();
    }

    return res.status(200).json({
      aiScore,
      feedbackText,
      rewriteText,
      shortText,
      educationText: eduText,
      doctorText,
    });
  } catch (err) {
    console.error("evaluate-report error:", err);
    return res.status(500).json({
      error: "AI評価中にサーバ側エラーが発生しました。",
      detail: err.message || String(err),
    });
  }
}
