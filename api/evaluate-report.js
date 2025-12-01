import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    mode = "report",
    reportText,
    localScore,
    missingRequired = [],
    missingOptional = []
  } = req.body || {};

  if (!reportText) {
    return res.status(400).json({ error: "reportText is required" });
  }

  const modeLabel =
    mode === "instruction"
      ? "指示モード（上から下への指示）"
      : "共有・報告モード（現場からの報告）";

  const roleText =
    mode === "instruction"
      ? "あなたは日本の介護施設で働く管理者・看護師長として、「職員に出す指示」が現場で誤解なく実行されるかどうかを点検する役割です。"
      : "あなたは日本の介護施設で働く看護師兼管理者として、「職員からの事故・状態変化などの報告文」をプロの目線でチェックする役割です。";

  const focusText =
    mode === "instruction"
      ? "・指示の目的が伝わるか\n・誰が、いつ、何を、どの程度行うかが明確か\n・完了条件と報告ラインがはっきりしているか\n・職員が現場で迷わず動ける内容か"
      : "・安全に関わる情報（バイタル・意識状態など）が抜けていないか\n・第三者が読んでも状況が正しくイメージできるか\n・再発防止や今後の観察ポイントが含まれているか";

  const systemPrompt = `
${roleText}

トーンは、叱責ではなく
・良い点をしっかり認める
・必要な指摘は遠回しにせず具体的に伝える
・一緒に報告・指示の質を上げていくコーチング
を心掛けてください。
`.trim();

  const userPrompt = `
【モード】
${modeLabel}

【ローカルスコアの情報】
・ローカルスコア：${localScore ?? "不明"}
・必ず書いておきたい項目として不足していると判定された項目：
${missingRequired.length ? "- " + missingRequired.join("\n- ") : "なし"}
・あるとより良い項目として不足していると判定された項目：
${missingOptional.length ? "- " + missingOptional.join("\n- ") : "なし"}

【チェックの観点】
${focusText}

【職員が作成した内容】
${reportText}

---

上記をふまえて、以下の形式で日本語で出力してください。

① 総評（2〜3文）
　- 良い点（必ず1つ以上）
　- 気になる点（抽象的な「もう少し詳しく」ではなく、具体的に）

② 良い点の具体例（箇条書き）

③ 改善したほうが良い点（箇条書き）
　- なぜそれが必要か、短く理由も添えてください。

④ 追加で確認・記載してほしい情報（箇条書き）

⑤ 書き直し例（丁寧な文体）
　- 施設の管理者や看護師が読んで、状況や指示内容がすぐに分かるレベルの文章にしてください。
　- 職員本人を責めるニュアンスは入れないでください。

最後に、100点満点中の総合点を「スコア：85」のように一行だけ付けてください。
`.trim();

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const fullText = completion.choices[0].message.content || "";

    // スコア抽出（「スコア：85」など）
    let aiScore = null;
    const scoreMatch = fullText.match(/スコア[:：]\s*(\d{1,3})/);
    if (scoreMatch) {
      const s = parseInt(scoreMatch[1], 10);
      if (!Number.isNaN(s)) {
        aiScore = s;
      }
    }

    // 書き直し例（⑤以降）をざっくり抽出
    let rewriteText = "";
    const rewriteIndex = fullText.indexOf("⑤");
    if (rewriteIndex >= 0) {
      rewriteText = fullText.slice(rewriteIndex).replace(/^⑤[^\n]*\n?/, "");
    }

    return res.status(200).json({
      aiScore,
      feedbackText: fullText,
      rewriteText
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "AI評価に失敗しました"
    });
  }
}
