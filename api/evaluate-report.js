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
      flow, // "generateQuestions" | "buildReport" | "fullEvaluate" | undefined
      mode,
      seedText,
      userName,
      qaLog,
      basicInfo,
      reportText,
      localScore,
      includeEducation,
    } = body;

    const modeLabel =
      mode === "instruction" ? "指示モード" : "共有・報告モード";

    // ---------------------------------------------------
    // ① generateQuestions : Q + POINT を返す
    // ---------------------------------------------------
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
- 新人職員にも学びになるように、各質問の意図（POINT）も伝える

【出力形式】
下記の JSON だけを出力してください。余分な文章を書いてはいけません。

{
  "questions": [
    { "question": "質問文", "point": "この質問で何を確認したいか（新人向け解説）" },
    ...
  ]
}

ルール：
- 質問は3〜7個
- 現場職員が答えやすい、日本語として自然な聞き方
- POINT は1〜2文で簡潔に
      `.trim();

      const userPrompt = `
【モード】${modeLabel}
【対象利用者】${userName || "（未記入）"}

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
        // JSONとして解釈できなければ簡易パース（保険）
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
            question: "まず、いつ・どこで・誰に起きた出来事かを教えてください。",
            point:
              "報告の基本である「いつ・どこで・誰に」は、最初に必ず押さえておきたい情報です。",
          },
        ];
      }

      return res.status(200).json({ questions });
    }

    // ---------------------------------------------------
    // ② buildReport : Q&A と基本情報から本文生成
    // ---------------------------------------------------
    if (flow === "buildReport") {
      if (!qaLog || !Array.isArray(qaLog) || qaLog.length === 0) {
        return res.status(400).json({
          error: "buildReport には qaLog（Q&Aの配列）が必要です。",
        });
      }

      const systemPrompt = `
あなたは介護施設の「看護師長 兼 管理者」です。
現場職員との Q&A と基本情報をもとに、施設内共有向けの報告文を作成します。

【ルール】
- 誰が・いつ・どこで・何をしているときに・どうなったか を分かりやすく整理する
- 安全面・再発防止の観点から重要な事実は落とさない
- 箇条書きではなく、文章として読める形にまとめる（必要なら段落分けOK）
- 不明な点は「情報不足のため不明」と記載し、勝手に補わない
- 見出しは 「■ 概要」「■ 基本情報」「■ 経過」「■ 実施した対応」「■ 今後の観察・報告ライン」 程度に整理する
- POINT や解説は本文には含めない（報告文としてそのまま使える形にする）
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

    // ---------------------------------------------------
    // ③ fullEvaluate : 評価＋書き直し＋3行要約＋新人ポイント
    // ---------------------------------------------------
    if (!reportText || !mode) {
      return res.status(400).json({
        error: "fullEvaluate には mode と reportText が必要です。",
      });
    }

    const systemPrompt = `
あなたは介護施設の「看護師長 兼 管理者」として、
現場職員の報告力・判断力・ケアの質を育てるAIメンターです。

【基本ルール】
- 曖昧な表現があれば必ず指摘し、専門職向けの客観的な表現に変換する。
- 不足情報は勝手に補わず、「情報不足」と明記する。
- 職員を責めず、次に活かせるフィードバックを行う。
- 文章構成の整理・重複削除・時系列整理も行う。

【新人向け教育】
- 適切な専門表現・言い換え
- ケース別の観察ポイント
- 初期対応の基本
- 看護師／管理者／家族への報告ライン
- 危険サイン（Red Flag）
- 次回の似たケースでの考え方
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
    ? `⑦ 新人向けポイント（教育用）
- 適切な専門表現・言い換え
- このケースで必ず観察すべき項目
- 初期対応のポイント
- 誰に・どのタイミングで報告すべきか
- 危険サイン（Red Flag）と理由
- 次回似たケースでの考え方（思考のフレーム）`
    : ""
}

最後に「スコア：85」のように 0〜100 の総合点を1つだけ示してください。

さらに ${includeEducation ? "回答の一番最後に" : ""}  
3行要約だけを次の形式で再掲してください：

<<SHORT>>
（ここに3行要約のみ）
<<END_SHORT>>

${
  includeEducation
    ? `
そして、新人向けポイント（⑦）の内容だけを次の形式で再掲してください：

<<EDU>>
（ここに新人向けポイントのみ）
<<END_EDU>>`
    : ""
}
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

    // SHORT/EDU を除いたフィードバック本文
    const feedbackText = full
      .replace(/<<SHORT>>[\s\S]*?<<END_SHORT>>/, "")
      .replace(/<<EDU>>[\s\S]*?<<END_EDU>>/, "")
      .trim();

    // ⑤以降の書き直し例（ざっくり）
    let rewriteText = "";
    const rewriteMatch = feedbackText.match(/⑤[^\n]*\n([\s\S]*)/);
    if (rewriteMatch) rewriteText = rewriteMatch[1].trim();

    return res.status(200).json({
      aiScore,
      feedbackText,
      rewriteText,
      shortText,
      educationText: eduText,
    });
  } catch (err) {
    console.error("evaluate-report error:", err);
    return res.status(500).json({
      error: "AI評価中にサーバ側エラーが発生しました。",
      detail: err.message || String(err),
    });
  }
}
