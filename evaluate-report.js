// api/evaluate-report.js
// Vercel のサーバーレス関数（OpenAI で報告のAIフィードバックを返す）

export default async function handler(req, res) {
  // CORS 設定（GitHub Pages など別ドメインから呼べるように）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 生のリクエストボディを読み取る
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyString = Buffer.concat(chunks).toString("utf8") || "{}";
    const body = JSON.parse(bodyString);

    const reportText = body.reportText || "";
    const fields = body.fields || {};

    if (!reportText) {
      return res.status(400).json({ error: "reportText is required" });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY is not set");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // 介護報告用のプロンプト
    const prompt = `
あなたは日本の介護施設の管理者です。
以下の「報告文」と「入力項目」を読み、新人〜中堅職員の学習のために
分かりやすいフィードバックを行ってください。

【報告文】
${reportText}

【項目ごとの入力内容】
${JSON.stringify(fields, null, 2)}

次の JSON 形式で日本語のみで出力してください。
余計な文章は一切つけず、そのまま JSON だけを返してください。

{
  "score": 0,                   // 0〜100 の整数スコア
  "levelLabel": "短いラベル",    // 例: "Lv.2 要点は押さえられている"
  "comment": "全体フィードバック（良かった点・改善点・次回意識するポイントなど）",
  "rewriteExample": "より伝わる報告文の書き直し例（3〜6文程度）"
}
    `.trim();

    // OpenAI Chat Completions API を呼び出し
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // 軽量で安いモデル。必要なら gpt-4o に変更可
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "あなたは日本の介護現場に詳しい管理者です。新人職員にも分かりやすい言葉で、やさしく・具体的にフィードバックを返してください。",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error("OpenAI API error:", apiRes.status, errText);
      return res.status(500).json({ error: "OpenAI API error" });
    }

    const completion = await apiRes.json();
    const content = completion.choices?.[0]?.message?.content || "";

    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      // JSON で返ってこなかった場合は、最低限の形にする
      console.error("Failed to parse AI JSON:", e, content);
      data = {
        score: 0,
        levelLabel: "AI解析に失敗しました",
        comment:
          "AIフィードバックの解析に失敗しました。しばらく時間をおいて再度お試しください。",
        rewriteExample: "",
      };
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
