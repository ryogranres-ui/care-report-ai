// -----------------------------------------------------------
//  Care Report AI - evaluate-report.js（Vercel serverless）
// -----------------------------------------------------------

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
    const {
      flow, // "question" | undefined
      mode,
      reportText,
      localScore,
      missingRequired,
      missingOptional,
      seedText,
      includeEducation,
    } = req.body || {};

    const modeLabel =
      mode === "instruction" ? "指示モード" : "共有・報告モード";

    // ==============================
    // ① 質問生成モード
    // ==============================
    if (flow === "question") {
      if (!seedText || !mode) {
        return res.status(400).json({
          error: "flow=question の場合、mode と seedText が必須です。",
        });
      }

      const systemPrompt = `
あなたは介護施設の「看護師長 兼 管理者」です。
職員から簡単な状況説明を聞き、その内容をもとに
必要な情報を漏れなく集めるための「質問リスト」を作成します。

【ルール】
- 3〜7個程度の質問にまとめる
- 「はい／いいえ」で答えられる質問と、短い文章で答える質問を混ぜる
- 現場職員が答えやすい、日本語として自然な聞き方にする
- 事故・状態変化・日常の様子の共有でよく使う観察ポイントも含める
- 文章の先頭に「Q1:」「Q2:」の形式で番号を付ける
- 質問文だけを出力し、解説や前置きは書かない
      `.trim();

      const userPrompt = `
【モード】${modeLabel}

【職員からの簡単な状況説明】
${seedText}

上記の内容をもとに、
職員から必要な情報を聞き出すための質問を作成してください。
      `.trim();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const fullText = completion.choices?.[0]?.message?.content || "";
      const lines = fullText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const questions = [];
      for (const line of lines) {
        const m = line.match(/Q\d+[:：]\s*(.+)/);
        if (m) {
          questions.push(m[1].trim());
        } else if (!line.startsWith("Q") && line.length > 0) {
          questions.push(line);
        }
      }

      if (!questions.length) {
        questions.push("状況をもう少し具体的に教えてください。");
      }

      return res.status(200).json({ questions });
    }

    // ==============================
    // ② 従来の評価モード
    // ==============================
    if (!reportText || !mode) {
      return res.status(400).json({
        error: "mode と reportText は必須です。",
      });
    }

    const systemPrompt = `
あなたは介護施設の「看護師長 兼 管理者」として、
現場職員の報告力・判断力・ケアの質を育てるAIメンターです。

【基本ルール】
- 曖昧な表現があれば必ず指摘し、専門職向けの客観的な表現に変換する。
- 不足情報は勝手に補わず、「情報不足」と明記する。
- 文章は、誰が読んでも分かるように簡潔に。
- 職員を責める言い方は禁止。改善の方向性と「次回への学び」を伝える。
- 文章構成の整理・重複削除・時系列整理も積極的に行う。

【新人向け教育について】
新人職員が数年かけて身につけるような内容を、短時間で学べるようにします。
- 適切な専門表現・言い換え
- ケース別の観察ポイント（転倒・発熱・食事拒否・便秘・服薬ミス・認知症の周辺症状など）
- 初期対応の基本
- 看護師／管理者／家族への報告ライン
- 危険サイン（Red Flag）
- 「次に似たケースが来たとき、どう考えると良いか」
    `.trim();

    const userPrompt = `
【モード】${modeLabel}

【ローカルスコア】
${localScore} 点

【不足している可能性のある項目】
- 必須: ${
      missingRequired && missingRequired.length
        ? missingRequired.join("／")
        : "なし"
    }
- 任意: ${
      missingOptional && missingOptional.length
        ? missingOptional.join("／")
        : "なし"
    }

【チェックの観点】
- 安全面（急変・再発・危険の見落としがないか）
- 情報抜け漏れ（誰が／いつ／どこで／何をした／どうなった）
- 指示モードでは「いつまでに・どこまでやれば完了か」が明確か
- 専門職が読んで分かる具体性
- 新人にとって学びになる観点（専門表現・観察ポイント・対応・危険サインなど）

【職員が作成した文章】
---
${reportText}
---

【出力フォーマット】
① 総評（1〜3行）
② 曖昧表現の指摘と改善案（箇条書きOK）
③ 不足している情報（事実ベースで）
④ 管理者として追加で確認したい点（質問リスト）
⑤ 専門的な書き直し例（全文）
⑥ 夜勤・申し送り用の3行要約（重要な事実のみ）

${
  includeEducation
    ? `⑦ 新人向けポイント（教育用）  
以下の観点を、過不足なく・簡潔にまとめてください。  
- 適切な専門表現・言い換え  
- このケースで必ず観察すべき項目  
- 初期対応のポイント（何を優先するか）  
- 看護師／管理者／家族など、誰にどのタイミングで報告すべきか  
- 危険サイン（Red Flag）と、その理由  
- 次に似たケースが来たときに、どう考えると良いか（思考のフレーム）`
    : ""
}

最後に「スコア：85」のように 0〜100 の総合点を1つだけ示してください。

さらに ${includeEducation ? "**回答の一番最後** に、" : ""}  
夜勤・申し送り用の3行要約のみを次の形式で再掲してください：

<<SHORT>>
（ここに3行要約のみ）
<<END_SHORT>>

${
  includeEducation
    ? `
そして、新人向けポイント（⑦）の内容のみを次の形式で再掲してください：

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

    const fullText = completion.choices?.[0]?.message?.content || "";

    // スコア抽出
    const scoreMatch = fullText.match(/スコア[:：]\s*(\d{1,3})/);
    const aiScore = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : null;

    // SHORT抽出
    let shortText = "";
    const shortMatch = fullText.match(/<<SHORT>>([\s\S]*?)<<END_SHORT>>/);
    if (shortMatch) {
      shortText = shortMatch[1].trim();
    }

    // EDU抽出
    let educationText = "";
    if (includeEducation) {
      const eduMatch = fullText.match(/<<EDU>>([\s\S]*?)<<END_EDU>>/);
      if (eduMatch) {
        educationText = eduMatch[1].trim();
      }
    }

    // SHORT/EDUブロックを除いたフィードバック全文
    const feedbackText = fullText
      .replace(/<<SHORT>>[\s\S]*?<<END_SHORT>>/, "")
      .replace(/<<EDU>>[\s\S]*?<<END_EDU>>/, "")
      .trim();

    // ⑤以降の書き直し例
    let rewriteText = "";
    const rewriteMatch = feedbackText.match(/⑤[^\n]*\n([\s\S]*)/);
    if (rewriteMatch) {
      rewriteText = rewriteMatch[1].trim();
    }

    return res.status(200).json({
      aiScore,
      feedbackText,
      rewriteText,
      shortText,
      educationText,
    });
  } catch (err) {
    console.error("API evaluate-report error:", err);

    return res.status(500).json({
      error: "AI評価中にサーバ側エラーが発生しました。",
      detail: err.message || String(err),
    });
  }
}
