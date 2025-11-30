const eventDetailInput = document.getElementById("eventDetail");
const eventTimeInput = document.getElementById("eventTime");
const eventPlaceInput = document.getElementById("eventPlace");
const eventPersonInput = document.getElementById("eventPerson");

const vitalBpHighInput = document.getElementById("vitalBpHigh");
const vitalBpLowInput = document.getElementById("vitalBpLow");
const vitalPulseInput = document.getElementById("vitalPulse");
const vitalSpo2Input = document.getElementById("vitalSpo2");
const vitalTempInput = document.getElementById("vitalTemp");

const currentStateInput = document.getElementById("currentState");

const requestActionInput = document.getElementById("requestAction");
const outputArea = document.getElementById("output");
const generateBtn = document.getElementById("generate");

generateBtn.addEventListener("click", () => {
  let lines = [];

  // 何が起きた？
  if (eventDetailInput.value.trim()) {
    lines.push("■ 何が起きた？");
    lines.push(eventDetailInput.value.trim());
    lines.push("");
  }

  // いつ？
  if (eventTimeInput.value.trim()) {
    lines.push("■ いつ？");
    lines.push(eventTimeInput.value.trim());
    lines.push("");
  }

  // どこで？
  if (eventPlaceInput.value.trim()) {
    lines.push("■ どこで？");
    lines.push(eventPlaceInput.value.trim());
    lines.push("");
  }

  // 誰が？
  if (eventPersonInput.value.trim()) {
    lines.push("■ 誰が？");
    lines.push(eventPersonInput.value.trim());
    lines.push("");
  }

  // 今の状態 / バイタル
  let stateLines = [];

  // バイタル
  if (
    vitalBpHighInput.value ||
    vitalBpLowInput.value ||
    vitalPulseInput.value ||
    vitalSpo2Input.value ||
    vitalTempInput.value
  ) {
    let v = "【バイタル】";

    if (vitalBpHighInput.value && vitalBpLowInput.value) {
      v += ` 血圧 ${vitalBpHighInput.value}/${vitalBpLowInput.value} mmHg`;
    }
    if (vitalPulseInput.value) {
      v += `｜脈拍 ${vitalPulseInput.value} 回/分`;
    }
    if (vitalSpo2Input.value) {
      v += `｜SpO₂ ${vitalSpo2Input.value}%`;
    }
    if (vitalTempInput.value) {
      v += `｜体温 ${vitalTempInput.value}℃`;
    }

    stateLines.push(v);
  }

  // 今の様子コメント
  if (currentStateInput.value.trim()) {
    stateLines.push(currentStateInput.value.trim());
  }

  if (stateLines.length > 0) {
    lines.push("■ 今の状態・変化");
    lines.push(stateLines.join("\n"));
    lines.push("");
  }

  // 相手にしてほしいこと
  if (requestActionInput.value.trim()) {
    lines.push("■ 相手にしてほしいこと");
    lines.push(requestActionInput.value.trim());
  }

  // 出力
  outputArea.textContent = lines.join("\n");
});
