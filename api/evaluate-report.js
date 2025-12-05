// api/evaluate-report.js
// Care Report AI 用 Vercel サーバレス関数（フル書き換え版）

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 質問生成・評価用（賢いがやや高コスト）
const QUESTION_MODEL =
  process.env.OPENAI_QUESTION_MODEL || "gpt-4.1";

// 整形・軽いタスク用（安いモデル。今後分離したいとき用）
const MINI_MODEL =
  process.env.OPENAI_MINI_MODEL || "gpt-4o-mini";

// --------- 共通ユーティリティ ---------

/**
 * Chat Completion を呼び出し、JSONを返す。
 * モデルの出力が ```json ... ``` などになっていてもパースできるように調整。
 */
async function callJsonChat({ model, system, user, temperature = 0.4 }) {
  const completion = await client.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";

  const jsonText = extractJson(raw);

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    console.error("JSON parse error", err, "raw:", raw);
    throw new Error("AIからのJSONが正しく読み取れませんでした。");
  }
}

/**
 * テキストの中から JSON 部分だけを抜き出す。
 * 最初の { 〜 最後の } を取得。
 */
function extractJson(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return text; // ダメ元でそのまま返す
  }
  return text.slice(first, last + 1);
}

/**
 * リクエストボディの基本バリデーション
 */
function ensurePost(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return false;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({
      ok: false,
      error: "OPENAI_API_KEY が設定されていません。",
    });
    return false;
  }
  return true;
}

// --------- flow: classifyEvent ---------

/**
 * summary + basicInfo からイベント種別を分類する。
 * A: 事故・急な体調変化
 * B: じわじわした体調や様子の変化
 * C: 面会・行事・日常のようす（ポジティブ〜中立）
 * D: 物品・設備・シフトなどの業務連絡
 * E: よく分からない／複数が混ざる（AIにおまかせ）
 */
async function handleClassifyEvent(body) {
  const { summary, basicInfo = {}, manualCategory = null } = body || {};

  if (!summary || typeof summary !== "string") {
    throw new Error("summary が必要です。");
  }

  const system = `
あなたは日本の介護施設向けの報告支援ツールのアシスタントです。
入力される内容を読み、次の5分類のいずれかに判定します。

A: 事故・急な体調変化
  - 例: 転倒, 転落, 誤嚥疑い, 発熱, SpO2低下, 呼吸苦, 胸痛, 嘔吐, 出血, 急な血圧変動 など
B: じわじわした体調や様子の変化
  - 例: 食事量低下, 歩行のふらつき, 夜間不眠, ナースコール増加, 表情が暗い/不穏 など
C: 面会・行事・日常のようす（ポジティブ〜中立）
  - 例: 家族面会, レクリエーション, 外出, 散歩, 誕生日会, 好きな食事を食べた など
D: 物品・設備・シフトなどの業務連絡
  - 例: 物品不足, 設備故障, 水漏れ, シフト変更, マニュアル変更 など
E: 上記に当てはまらない／複数が混ざる／分類に迷うケース

【重要なルール】
- 医療的リスクが高いと思われるキーワード（転倒・嘔吐・SpO2低下・胸痛など）があれば、
  職員の選択にかかわらず A「事故・急な体調変化」を優先的に選びます。
- 職員が選んだ manualCategory が与えられている場合、
  それが明らかに不適切でない限り尊重し、調整のうえで finalCategory を決めてください。
- 返答は必ず日本語で、以下のJSON形式のみで返してください。
`;

  const userPayload = {
    summary,
    basicInfo,
    manualCategory, // null または "A"〜"E"
  };

  const user = `
以下は職員が入力した情報です（JSON）。

${JSON.stringify(userPayload, null, 2)}

次の形式のJSONだけを返してください:

{
  "finalCategory": "A" | "B" | "C" | "D" | "E",
  "categoryLabel": "事故・急な体調変化" など日本語ラベル,
  "reason": "その分類にした簡潔な理由"
}
`;

  const result = await callJsonChat({
    model: QUESTION_MODEL,
    system,
    user,
    temperature: 0.0,
  });

  return {
    ok: true,
    ...result,
  };
}

// --------- flow: nextQuestion ---------

/**
 * 1問ずつ次の質問を生成する。
 * 十分情報が集まったら done: true を返し、質問を終了する。
 */
async function handleNextQuestion(body) {
  const {
    summary,
    basicInfo = {},
    qaLog = [],
    eventCategory, // "A"〜"E" のどれかを想定
  } = body || {};

  if (!summary || typeof summary !== "string") {
    throw new Error("summary が必要です。");
  }

  if (!eventCategory) {
    throw new Error("eventCategory が必要です。");
  }

  const system = `
あなたは日本の介護施設向けの「AIヒアリング担当」です。
目的は「報告文を作るために、本当に必要な情報だけを、最小限の質問で集めること」です。

分類:
A: 事故・急な体調変化
B: じわじわした体調や様子の変化
C: 面会・行事・日常のようす
D: 物品・設備・シフトなどの業務連絡
E: その他／分類に迷う

【絶対ルール】
- basicInfo にすでに書かれている項目（利用者名, 日時, 場所, バイタルなど）を聞き直してはいけません。
- summary に明確に書いてある内容を「そのまま聞き直す」ことは禁止。
- qaLog にすでに含まれている質問内容を、言い方を変えて繰り返してはいけません。
- 1回の呼び出しで出す質問は「1問だけ」です。
- 十分な情報が集まったと判断したら、質問をやめて done: true を返してください。

【質問の方針】
- A（事故・急変）:
  - 転倒: 意識レベル, 頭部打撲, 出血, 服薬（抗血小板薬など）, 直後の様子
  - 発熱: いつから, 最大体温, 呼吸苦, 咳, 持病, 水分・食事量, 他の症状
  - 嘔吐: 回数, 色, 量, 腹痛, 下痢, 便通, 服薬
  - SpO2低下: 測定値, 呼吸状態, 胸痛, チアノーゼ, 安静時か動作時か
- B（じわじわ変化）:
  - 「いつから」「どのくらい」「日内変動」「頻度」「具体例」を深掘り。
- C（面会・行事）:
  - 誰が来たか, 滞在時間, 利用者の表情・発言, 家族の要望, 今後のケアのヒント。
  - 医療的リスクがなければ、バイタルを無理に聞かない。
- D（業務連絡）:
  - 何が起きたか, 場所, 影響範囲, 緊急度, 誰に対応を依頼したいか。
- E（その他）:
  - 上記方針のうちもっとも近いものを選び、柔軟に質問。

【回答形式】
必ず次のJSON形式のみを返してください。

- まだ質問が必要な場合:

{
  "done": false,
  "question": {
    "id": "vomit_color",
    "label": "嘔吐の色はどのような色でしたか？",
    "answerType": "singleChoice", // "singleChoice" | "multiChoice" | "freeText"
    "options": [
      "透明〜白っぽい",
      "黄色〜胆汁様",
      "茶色〜コーヒー残渣様",
      "赤色・血が混じる",
      "その他（自由入力）"
    ],
    "allowFreeText": true,
    "hintForBeginner": "色によって出血や腸閉塞など重症度の判断材料になります。"
  }
}

- もう十分な情報が集まった場合:

{
  "done": true,
  "question": null
}

補足:
- options が不要な自由記述質問の場合は、answerType を "freeText" にし、
  options は空配列 [] にしてください。
`;

  const userPayload = {
    eventCategory,
    summary,
    basicInfo,
    qaLog,
  };

  const user = `
以下は現在までに集まっている情報です（JSON）。

${JSON.stringify(userPayload, null, 2)}

上記を踏まえて、「次に聞くべき1問」または「質問終了」のどちらかを、
指定されたJSON形式で返してください。
`;

  const result = await callJsonChat({
    model: QUESTION_MODEL,
    system,
    user,
    temperature: 0.2,
  });

  // 念のため shape を軽く整える
  if (result.done === true) {
    return {
      ok: true,
      done: true,
      question: null,
    };
  }

  return {
    ok: true,
    done: false,
    question: result.question,
  };
}

// --------- flow: fullEvaluate ---------

/**
 * 事実ベースの本文(reportText)をもとに、
 * 評価・フィードバック・整形文章・3行メモ・医師向け要約をまとめて生成。
 *
 * NOTE:
 * 今は gpt-4.1 1回でまとめて生成しています。
 * 将来的にコストをさらに下げたい場合：
 *   - フィードバック: QUESTION_MODEL
 *   - 文章整形: MINI_MODEL
 * と2段階に分けてもOK。
 */
async function handleFullEvaluate(body) {
  const {
    basicInfo = {},
    summary,
    qaLog = [],
    eventCategory,
    reportText,
  } = body || {};

  if (!summary || typeof summary !== "string") {
    throw new Error("summary が必要です。");
  }
  if (!reportText || typeof reportText !== "string") {
    throw new Error("reportText（事実ベース本文）が必要です。");
  }

  const system = `
あなたは日本の介護施設向けの「報告文コーチ兼リライト担当」です。

目的:
- 職員が入力した「事実ベースの本文」をもとに、
  1) 管理者・看護師視点でのフィードバック
  2) 観察・対応の重要ポイント
  3) 施設内共有向けに整えた文章
  4) 夜勤・申し送り用の3行メモ
  5) 医師へ報告するときに使える5〜8行の要約
  を作成すること。

前提:
- reportText に書かれていることだけが「事実」です。
- QAで「対応していない」となっている内容を、勝手に「実施した対応」と書いてはいけません。
- 「一般的にはこうした方が良い」という内容は、あくまで「推奨事項」として別枠で触れても良いですが、
  実際に行っていないことを、行ったように書くことは禁止です。

イベント分類:
A: 事故・急な体調変化
B: じわじわした体調や様子の変化
C: 面会・行事・日常のようす（ポジティブ〜中立）
D: 物品・設備・シフトなどの業務連絡
E: その他

【重要ルール（カテゴリ別）】
- C（面会・行事）:
  - 原則として「良い出来事」「中立な出来事」として扱い、
    バイタル未記載のみを理由に厳しく減点しない。
  - コメントは「良かった点」「今後のケアに活かせる観察」に重心を置く。
- D（業務連絡）:
  - 利用者の状態判定は基本行わない。
  - 「何が・どこで・どの程度・誰に対応を依頼するか」を簡潔に整理する。
- A/B（医療リスク系）:
  - Red flag（すぐ医師へ相談すべき状態）があれば明示。
  - 観察ポイントと「このレベルなら施設内で経過観察」などの目安を、できる範囲で示す。

スコアについて:
- 0〜100点で、報告としての「情報の十分さ」「わかりやすさ」を評価します。
- CやDでは、過度に厳しくする必要はありません（例えば面会記録で60〜90点程度が中心）。
- AやBでは、重要情報の欠落が大きい場合にのみ、低い点数をつけてください。

出力フォーマット:
必ず次のJSON形式のみで返してください。

{
  "ok": true,
  "score": 0〜100の整数,
  "managerFeedback": "①総評...\n②良い点...\n③不足している情報...\n④確認したい点...",
  "keyPoints": "・観察すべきポイント...\n・Red flag（すぐ報告すべき兆候）...\n・報告タイミングの目安...",
  "improvedFacilityText": "施設内共有向けに整えた全文。敬体（です・ます調）で、見出しを簡潔に。",
  "shortShiftNote": "夜勤・申し送り用の3行メモ。",
  "doctorSummary": "医師へ電話／口頭で報告するときの5〜8行の要約。"
}
`;

  const userPayload = {
    eventCategory,
    basicInfo,
    summary,
    qaLog,
    reportText,
  };

  const user = `
以下が、職員が入力した情報と、事実ベースで整理された本文です（JSON）。

${JSON.stringify(userPayload, null, 2)}

これをもとに、指定されたJSON形式で評価と文章を生成してください。
`;

  const result = await callJsonChat({
    model: QUESTION_MODEL,
    system,
    user,
    temperature: 0.3,
  });

  return {
    ok: true,
    ...result,
  };
}

// --------- メインハンドラ ---------

export default async function handler(req, res) {
  if (!ensurePost(req, res)) return;

  try {
    const body = req.body || {};
    const { flow } = body;

    if (!flow) {
      return res.status(400).json({
        ok: false,
        error: "flow が指定されていません。",
      });
    }

    let result;

    switch (flow) {
      case "classifyEvent":
        result = await handleClassifyEvent(body);
        break;
      case "nextQuestion":
        result = await handleNextQuestion(body);
        break;
      case "fullEvaluate":
        result = await handleFullEvaluate(body);
        break;
      default:
        return res.status(400).json({
          ok: false,
          error: `未知の flow です: ${flow}`,
        });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({
      ok: false,
      error: err.message || "サーバ側でエラーが発生しました。",
    });
  }
}
