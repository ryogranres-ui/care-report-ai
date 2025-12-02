// api/evaluate-report.js
// 介護報告・指示文の AI 添削＆書き直し API（Vercel サーバレス関数）

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

  // --- モード別の説明・観点 ------------------------------------
  const modeLabel =
    mode === "instruction"
      ? "指示モード（上から下への指示）"
      : "共有・報告モード（現場からの報告）";

  const roleText =
    mode === "instruction"
      ? "あなたは日本の介護施設で働く『看護師長 兼 管理者』として、職員に出す指示が現場で誤解なく実行されるかどうかを点検し、より適切な指示文への書き換えと指導を行います。"
      : "あなたは日本の介護施設で働く『看護師 兼 管理者』として、職員からの事故・状態変化などの報告文をプロの目線で添削し、より適切な報告文への書き換えと指導を行います。";

  const focusText =
    mode === "instruction"
      ? [
          "・指示の目的が分かるか（なぜ必要なのか）",
          "・誰が、いつ、どの時間帯に、何を、どの程度行うのかが明確か",
          "・完了条件と報告ラインがはっきりしているか",
          "・現場の職員が具体的に行動イメージを持てるか",
          "・危険が予測される場合に、注意点や優先順位が示されているか"
        ].join("\n")
      : [
          "・安全に関わる情報（意識・呼吸・バイタル・転倒状況など）が抜けていないか",
          "・第三者が読んでも状況を正しくイメージできるか（いつ・どこで・誰が・どうなったか）",
          "・時系列（前後の経過）が分かるか",
          "・今後の観察ポイントや再発防止の視点が含まれているか",
          "・家族・医師・管理者への報告ラインが明確か"
        ].join("\n");

  // --- system プロンプト：AIの「性格」 -------------------------
  const systemPrompt = `
${roleText}

あなたは「文章をきれいにする人」ではなく、
「現場職員の報告力・指示力を育てるコーチ」です。

必ず日本語で出力してください。

トーンは以下を守ってください：
- 職員を責めず、まず良い点を認める
- しかし曖昧な表現や危ない表現は、プロとしてはっきり指摘する
- 「ダメ出し」ではなく「こう書くともっと伝わります」という目線
- 新人職員でも理解できる言葉で、簡潔に説明する

特に次の点を重視して添削してください：
- 「ぐったりしている」「元気がない」「なんか変」「しんどそう」などの曖昧な表現は、
  可能な限り客観的・観察的な表現（例：表情が乏しい、発語が少ない、応答に時間がかかる 等）に書き換える
- 時間・場所・対象者・きっかけ・経過・結果の5つの軸が分かるようにする
- 医療的な判断が関わる部分（発熱・呼吸状態・転倒・意識レベルなど）は、
  推測で書かず「〜と思われる」ではなく、観察事実を優先する
- 情報が不足しているときは、想像で補わず「ここは情報不足です」と明確に伝える
- 「この表現の方が専門職同士で伝わりやすい」という言い換えを積極的に提案する

書き直し例では、事実をねじ曲げず、与えられた情報の範囲で最も分かりやすい文章にしてください。
不足している情報は、勝手に作らず、必要に応じて「※◯◯の情報があれば、さらに良いです」とコメントで示してください。
`.trim();

  // --- user プロンプト：毎回の具体的な指示 --------------------
  const userPrompt = `
【モード】
${modeLabel}

【ローカルスコアの情報】
- ローカルスコア：${localScore ?? "不明"}
- 必ず書いておきたい項目として不足していると判定された項目：
  ${missingRequired.length ? "- " + missingRequired.join("\n  - ") : "なし"}
- あるとより良い項目として不足していると判定された項目：
  ${missingOptional.length ? "- " + missingOptional.join("\n  - ") : "なし"}

【チェックの観点】
${focusText}

【職員が作成した内容（そのまま）】
${reportText}

---

上記をふまえて、次のフォーマットで日本語で出力してください。

① 総評（2〜3文）
- まず良い点を1つ以上挙げる
- 次に、報告・指示として気になる点を具体的に述べる

② 曖昧な表現・気になる表現の指摘と改善案（箇条書き）
- 1項目ごとに
  「元の表現」→「より適切な表現」→「理由」
  の順で書いてください。

③ 不足している情報（箇条書き）
- 時系列・症状・観察ポイント・安全面などの観点から、
  「ここが書かれていると判断しやすい」という項目を具体的に列挙してください。

④ 管理者として追加で確認したい点（箇条書き）

⑤ 専門的な書き直し例（全文）
- ${mode === "instruction" ? "職員に出す指示文として" : "管理者・看護師が読む報告文として"}、誤解なく伝わる日本語に書き直してください。
- 曖昧語は可能な限り客観的な表現に置き換えてください。
- 不足している情報については、推測せずに「※この部分の情報があれば、さらに判断しやすくなります」とコメントで補足してください。

最後に、100点満点中の総合点を
「スコア：85」
のように1行だけ付けてください。
`.trim();

  try {
    const completion = await client.chat.completions.create({
      // ★ ここを gpt-4o-mini にしています（安定版）
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const fullText = completion.choices[0].message.content || "";

    // --- スコア抽出（「スコア：85」形式） ---------------------
    let aiScore = null;
    const scoreMatch = fullText.match(/スコア[:：]\s*(\d{1,3})/);
    if (scoreMatch) {
      const s = parseInt(scoreMatch[1], 10);
      if (!Number.isNaN(s)) {
        aiScore = s;
      }
    }

    // --- ⑤書き直し例だけざっくり抜き出す ----------------------
    let rewriteText = "";
    const rewriteIndex = fullText.indexOf("⑤");
    if (rewriteIndex >= 0) {
      rewriteText = fullText
        .slice(rewriteIndex)
        .replace(/^⑤[^\n]*\n?/, "")
        .trim();
    }

    return res.status(200).json({
      aiScore,
      feedbackText: fullText,
      rewriteText
    });
  } catch (error) {
    console.error("AI評価エラー:", error);

    // デバッグ用にメッセージも返しておく（フロントには表示しないが必要なら見られる）
    return res.status(500).json({
      error: "AI評価に失敗しました",
      errorMessage: error.message || null
    });
  }
}
