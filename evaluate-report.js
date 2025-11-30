// api/evaluate-report.js
// Vercel のサーバーレス関数（OpenAI で報告のAIフィードバックを返す）

export default async function handler(req, res) {
  // CORS 設定（別ドメインから呼ぶ場合に備えて）
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
    // --- リクエストボディを安全に取り出す（body / 生ストリーム両対応） ---
    let reportText = "";
    let fields = {};

    if (req.body && Object.keys(req.body).length > 0) {
      // Vercel が JSON をパースしてくれているパターン
      reportText = req.body.reportText || "";
      fields = req.body.fields || {};
    } else {
      // 念のため、生のストリームから読むパターンも用意
      let raw = "";
      await new Promise((resolve, reject) => {
        req.on("data", (chunk) => {
          raw += chunk;
        });
        req.on("end", resolve);
        req.on("error", reject);
      });

      if (raw) {
        const parsed = JSON.parse(raw);
        reportText = parsed.reportText || "";
        fields = parsed.fields || {};
      }
    }

    if (!reportText) {
      return res.status(400).json({ error: "reportText is required" });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY is not set");
      return res
        .status(500)
        .json({ error: "OPENAI_API_KEY is not set on server" });
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
        model: "gpt-4o-mini", // 軽量で安いモデル
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

    // OpenAI 側でエラーの場合 → エラー内容をそのまま返す（デバッグ用）
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error("OpenAI API error:", apiRes.status, errText);

      return res.status(200).json({
        error: "OpenAI API error",
        status: apiRes.status,
        detail: errText.slice(0, 500), // 長すぎる時は先頭だけ
      });
    }

    const completion = await apiRes.json();
    const content = completion.choices?.[0]?.message?.content || "";

    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
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
    return res.status(200).json({
      error: "Server error",
      detail: String(err),
    });
  }
}
