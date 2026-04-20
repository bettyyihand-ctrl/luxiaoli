export type DocType = "和解协议" | "民事起诉状" | "证据目录";

type FieldMap = Record<string, string>;

/** Returns fallback (default "___") when pattern has no match. */
function e(text: string, pattern: RegExp, fallback = "___"): string {
  const m = text.match(pattern);
  const val = m ? (m[1] ?? "").trim().replace(/\*+/g, "").trim() : "";
  return val || fallback;
}

/** Like e() but returns "" on no match — safe for || chains. */
function eFirst(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  const val = m ? (m[1] ?? "").trim().replace(/\*+/g, "").trim() : "";
  return val;
}

function cleanText(rawText: string): string {
  return rawText
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/<data>[\s\S]*?<\/data>/g, "");
}

/** Slice the text into named sections by finding header positions. */
function slice(text: string, from: RegExp, until: RegExp): string {
  const start = text.search(from);
  if (start === -1) return "";
  const rest = text.slice(start);
  const end = rest.search(until);
  return end === -1 ? rest : rest.slice(0, end);
}

function extractSettlement(text: string): FieldMap {
  // Split into party sections and body
  const partyA = slice(text, /甲方[（(]/, /乙方[（(]/);
  const partyB = slice(text, /乙方[（(]/, /第一条|甲乙双方经/);
  const body   = slice(text, /第一条|甲乙双方经/, /$/) || text;

  const ea = (p: RegExp, fb = "___") => e(partyA, p, fb);
  const eb = (p: RegExp, fb = "___") => e(partyB, p, fb);

  // Dates — handle both "2026年4月19日" and "2026.4.19"
  const accDate = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) ??
    text.match(/(\d{4})[.·](\d{1,2})[.·](\d{1,2})/);

  // Signature line: "甲方：裴蕴茜（签字）时间：2026.4.19  乙方：孙昭祺（签字）"
  const sigA    = text.match(/甲方[：:]\s*([^\n（(,，\s]{2,15}?)\s*[（(]?签字/);
  const sigB    = text.match(/乙方[：:]\s*([^\n（(,，\s]{2,15}?)\s*[（(]?签字/);
  const sigTime = text.match(/(?:时间|签字时间)[：:]\s*([\d年月日./]+)/);
  const today   = new Date();
  const signDate = sigTime?.[1] ??
    `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  // Payment deadline: "甲方于2026.4.30前" or "付款期限：..."
  const payDeadline =
    e(text, /甲方于\s*([\d年月日./]+前)/) ||
    e(text, /于\s*([\d年月日./]+(?:前|之前))/) ||
    e(text, /付款(?:期限|截止)[：:]\s*([^\n,，.。]{4,30})/);

  // Total compensation: "共计人民币1500元" / "总计1500元"
  const totalComp =
    eFirst(text, /共计(?:人民币)?\s*([\d,.]+)\s*元/) ||
    eFirst(text, /(?:总计|合计)(?:人民币)?\s*([\d,.]+)\s*元/) || "___";
  const totalCn =
    eFirst(text, /共计(?:人民币)?[\d,.]+元[（(](?:大写[：:])?([^）)]+)[）)]/) ||
    eFirst(text, /(?:总计|合计)[\d,.]+元[（(](?:大写[：:])?([^）)]+)[）)]/) || "___";

  // Sub-total for other fees: "合计500元（大写：伍佰元整）"
  const otherTotal =
    eFirst(body, /误工费[\s\S]{0,120}?合计[：:\s]*([\d,.]+)\s*元/) ||
    eFirst(body, /合计[：:\s]*([\d,.]+)\s*元/) ||
    eFirst(text, /其他(?:合理)?费用[：:\s]*([\d,.]+)\s*元/) || "___";
  const otherTotalCn =
    eFirst(body, /合计[：:\s]*[\d,.]+元[（(](?:大写[：:])?([^）)]+)[）)]/) ||
    eFirst(text, /合计[\d,.]+元[（(]([^）)]+)[）)]/) || "___";

  return {
    // Party A — extracted from 甲方 section
    party_a_name:    ea(/姓名[：:]\s*([^\n,，。、]{1,15})/),
    party_a_nation:  ea(/民族[：:]\s*([^\n,，。、]{1,10})/),
    party_a_id:      ea(/身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    party_a_address: ea(/(?:住(?:所|址)|地址)[：:]\s*([^\n,，。]{4,60})/),

    // Party B — extracted from 乙方 section (avoids cross-contamination)
    party_b_name:    eb(/姓名[：:]\s*([^\n,，。、]{1,15})/),
    party_b_nation:  eb(/民族[：:]\s*([^\n,，。、]{1,10})/),
    party_b_id:      eb(/身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    party_b_address: eb(/(?:住(?:所|址)|地址)[：:]\s*([^\n,，。]{4,60})/),

    // Accident
    accident_date:     accDate?.[1] ?? "___",
    accident_month:    accDate?.[2] ?? "___",
    accident_day:      accDate?.[3] ?? "___",
    accident_time:     e(text, /(\d{1,2})[时時](?:\d{2})?分?/) || "___",
    accident_location:
      eFirst(text, /(?:事故)?地点[：:]\s*([^\n,，。]{4,60})/) ||
      eFirst(text, /发生(?:于|在)\s*([^\n,，]{4,50})/) || "___",

    // Vehicles
    car_a_plate: e(text, /甲方[\s\S]{0,500}?(?:车牌|号牌)[：:]\s*([^\n,，\s]{5,12})/),
    car_a_type:  e(text, /甲方[\s\S]{0,500}?车(?:辆)?(?:类型|型)[：:]\s*([^\n,，]{2,20})/),
    car_b_plate: e(text, /乙方[\s\S]{0,500}?(?:车牌|号牌)[：:]\s*([^\n,，\s]{5,12})/),
    car_b_type:  e(text, /乙方[\s\S]{0,500}?车(?:辆)?(?:类型|型)[：:]\s*([^\n,，]{2,20})/),

    // Liability
    party_a_liability: e(text, /甲方[\s\S]{0,600}?(?:全责|主责|次责|同等责任|责任比例?)[：(]?\s*([^\n,，.。（]{2,30})/),
    party_b_liability: e(text, /乙方[\s\S]{0,600}?(?:全责|主责|次责|同等责任|责任比例?)[：(]?\s*([^\n,，.。（]{2,30})/),

    // Fees — note: AI often writes "误工费0元" with NO colon, hence [：:\s]*
    medical_fee_paid:   e(text, /医疗费[：:\s]*([\d,.]+)\s*元/),
    medical_fee_future: e(text, /(?:预期|后续|未来)医疗费[：:\s]*([\d,.]+)\s*元/),
    car_a_repair: e(body, /甲方[\s\S]{0,400}?维修费[：:\s]*([\d,.]+)\s*元/),
    car_a_bear:   e(body, /甲方[\s\S]{0,400}?承担[：:\s]*([\d,.]+)\s*元/),
    car_b_repair: e(body, /乙方[\s\S]{0,400}?维修费[：:\s]*([\d,.]+)\s*元/),
    car_b_bear:   e(body, /乙方[\s\S]{0,400}?承担[：:\s]*([\d,.]+)\s*元/),
    lost_income:   e(text, /误工费[：:\s]*([\d,.]+)\s*元/),
    transport_fee: e(text, /交通费[：:\s]*([\d,.]+)\s*元/),

    other_fee_total:    otherTotal,
    other_fee_total_cn: otherTotalCn,
    payment_deadline:   payDeadline,
    total_compensation:    totalComp,
    total_compensation_cn: totalCn,

    // Bank
    bank_account_name:  e(text, /开户名(?:称)?[：:]\s*([^\n,，]{2,30})/),
    bank_account_owner: e(text, /账户(?:持有人|所有人)[：:]\s*([^\n,，]{2,30})/),
    bank_name:          e(text, /开户行[：:]\s*([^\n,，]{4,40})/),
    bank_account_no:    e(text, /(?:银行)?账号[：:]\s*([\d\s]{10,30})/),

    // Signatures — from "甲方：裴蕴茜（签字）时间：2026.4.19"
    party_a_sign: sigA?.[1] ?? e(text, /甲方[：:]\s*([^\n（(,，\s]{2,15})/),
    party_b_sign: sigB?.[1] ?? e(text, /乙方[：:]\s*([^\n（(,，\s]{2,15})/),
    sign_date: signDate,
  };
}

function extractComplaint(text: string): FieldMap {
  // Split by plaintiff / defendant sections
  const plaintiff  = slice(text, /原告[：\s（(]/, /被告[一1（(：\s]/);
  const defendant1 = slice(text, /被告(?:一|1|（一）|[：\s])/, /被告(?:二|2|（二）)|保险公司|诉讼请求|事实/);
  const defendant2 = slice(text, /被告(?:二|2|（二）)|保险公司/, /诉讼请求|事实/);

  // e()-based: returns "___" on failure (for standalone fields)
  const ep  = (p: RegExp, fb = "___") => e(plaintiff  || text, p, fb);
  const ed1 = (p: RegExp, fb = "___") => e(defendant1 || text, p, fb);
  const ed2 = (p: RegExp, fb = "___") => e(defendant2 || text, p, fb);
  // eFirst()-based: returns "" on failure (safe for || chains)
  const ep0  = (p: RegExp) => eFirst(plaintiff  || text, p);
  const ed10 = (p: RegExp) => eFirst(defendant1 || text, p);
  const ed20 = (p: RegExp) => eFirst(defendant2 || text, p);

  // Prefer date+time (accident) over birthdate; fall back to facts section then full text
  const accDateWithTime = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日[^\d\n]{0,15}?(\d{1,2})[时時:](\d{2})?/);
  const factsText = slice(text, /事实与理由|事实经过|事故经过/, /$/) || "";
  const accDate = accDateWithTime ??
    factsText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) ??
    text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const today = new Date();

  // Gender/nation: AI sometimes writes "，男，汉族" inline without separate labels
  const pGN  = (plaintiff  || "").match(/[，,]\s*(男|女)[，,\s]*([^\n，,。]{1,5}族)/);
  const d1GN = (defendant1 || "").match(/[，,]\s*(男|女)[，,\s]*([^\n，,。]{1,5}族)/);

  return {
    plaintiff_name:
      ep0(/姓名[：:]\s*([^\n,，（(\d]{2,15})/) ||
      ep0(/原告[^：:\n]{0,10}[：:]\s*([^\n,，（(\d]{2,15})/) || "___",
    plaintiff_gender:
      ep0(/性别[：:]\s*(男|女)/) || pGN?.[1] || "___",
    plaintiff_nation:
      ep0(/民族[：:]\s*([^\n,，。、]{1,10})/) || pGN?.[2] || "___",
    plaintiff_id_no:   ep(/身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    plaintiff_address: ep(/(?:住(?:所|址)|地址)[：:]\s*([^\n,，。]{4,60})/),
    plaintiff_phone:   ep(/(?:电话|联系方式)[：:]\s*([\d\-\s]{7,15})/),

    defendant1_name:
      ed10(/姓名[：:]\s*([^\n,，（(\d]{2,15})/) ||
      ed10(/被告[^：:\n]{0,15}[：:]\s*([^\n,，（(\d]{2,15})/) || "___",
    defendant1_gender:
      ed10(/性别[：:]\s*(男|女)/) || d1GN?.[1] || "___",
    defendant1_nation:
      ed10(/民族[：:]\s*([^\n,，。、]{1,10})/) || d1GN?.[2] || "___",
    defendant1_id_no:   ed1(/身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    defendant1_address: ed1(/(?:住(?:所|址)|地址)[：:]\s*([^\n,，。]{4,60})/),
    defendant1_phone:   ed1(/(?:电话|联系方式)[：:]\s*([\d\-\s]{7,15})/),

    defendant2_company:
      ed20(/(?:名称|单位名称|公司名称)[：:]\s*([^\n,，]{4,50})/) ||
      ed20(/被告[^：:\n]{0,15}[：:]\s*([^\n,，（(\d]{4,50})/) ||
      eFirst(text, /([^\n,，（(]{4,40}?保险[^\n,，）)]{0,15}(?:公司|股份))/) || "___",
    defendant2_credit_code:  ed2(/统一社会信用代码[：:]\s*([^\n,，\s]{15,20})/),
    defendant2_address:      ed2(/(?:住(?:所|址)|地址)[：:]\s*([^\n,，。]{4,60})/),
    defendant2_principal:    e(text, /(?:法定代表人|负责人)[：:]\s*([^\n,，]{2,15})/),
    defendant2_phone:        ed2(/(?:电话|联系方式)[：:]\s*([\d\-\s]{7,15})/),

    // Fees — AI often writes "误工费5000元" without colon
    medical_fee:            e(text, /医疗费[：:\s]*([\d,.]+)\s*元/),
    food_fee:               e(text, /(?:住院)?伙食(?:补助)?费[：:\s]*([\d,.]+)\s*元/),
    nutrition_fee:          e(text, /营养费[：:\s]*([\d,.]+)\s*元/),
    nursing_fee:            e(text, /护理费[：:\s]*([\d,.]+)\s*元/),
    lost_income:            e(text, /误工费[：:\s]*([\d,.]+)\s*元/),
    transport_fee:          e(text, /交通费[：:\s]*([\d,.]+)\s*元/),
    disability_compensation: e(text, /残疾赔偿金[：:\s]*([\d,.]+)\s*元/),
    mental_damage:          e(text, /精神损害(?:抚慰金)?[：:\s]*([\d,.]+)\s*元/),
    appraisal_fee:          e(text, /鉴定费[：:\s]*([\d,.]+)\s*元/),
    car_repair_fee:         e(text, /车辆维修费[：:\s]*([\d,.]+)\s*元/),
    other_loss:             e(text, /其他(?:损失|费用)[：:\s]*([\d,.]+)\s*元/),
    total_compensation:
      eFirst(text, /共计(?:人民币)?\s*([\d,.]+)\s*元/) ||
      eFirst(text, /(?:合计|总计|赔偿总额)[：:\s]*([\d,.]+)\s*元/) || "___",
    total_compensation_cn:
      eFirst(text, /共计(?:人民币)?[\d,.]+元[（(](?:大写[：:])?([^）)]+)[）)]/) ||
      eFirst(text, /(?:合计|总计)[\d,.]+元[（(]([^）)]+)[）)]/) || "___",

    accident_year:     accDate?.[1] ?? String(today.getFullYear()),
    accident_month:    accDate?.[2] ?? "___",
    accident_day:      accDate?.[3] ?? "___",
    accident_hour:     accDate?.[4] ?? "___",
    accident_minute:   accDate?.[5] ?? "00",
    accident_location:
      eFirst(text, /(?:事故)?地点[：:]\s*([^\n,，。]{4,60})/) ||
      eFirst(text, /发生(?:于|在)\s*([^\n，,]{4,50})/) ||
      eFirst(text, /(?:位于|在)([^\n，,]{4,50}(?:路|街|道|桥|路口|交叉口))/) || "___",

    // Car plates: labeled format preferred; fall back to narrative "驾驶XXX轿车/电动车"
    defendant1_car_plate:
      eFirst(text, /被告[\s\S]{0,200}?(?:车牌|号牌)(?:号码)?[：:]\s*([^\n,，\s。]{5,12})/) ||
      eFirst(text, /被告[\s\S]{0,100}?驾驶[的]?([^\s，,）)。（(]{5,12}?)(?:轿车|电动车|摩托车|车辆|汽车)/) || "___",
    plaintiff_car_plate:
      eFirst(plaintiff || "", /(?:车牌|号牌)(?:号码)?[：:]\s*([^\n,，\s。]{5,12})/) ||
      eFirst(text, /原告[^\n，,]{0,10}?驾驶[的]?([^\s，,）)。（(]{5,12}?)(?:轿车|电动车|摩托车|车辆|汽车)/) || "___",

    // Police unit: capture unit name ending in 大队/支队/局; exclude 。经由 to avoid mid-sentence capture
    police_dept:
      eFirst(text, /([^\n，,（(。经由\s]{2,15}?(?:公安局)?交警(?:大队|支队|总队|局))/) || "___",
    // Sub-unit: "第X大队" or 中队/分队
    police_branch:
      eFirst(text, /(第[一二三四五六七八九十\d]+大队)/) ||
      eFirst(text, /([^\n，,（(]{2,20}?交警(?:中队|分队))/) || "___",

    // Certificate number: AI may write "认定书编号：" or "责任认定书："
    accident_certificate_no:
      eFirst(text, /(?:责任)?认定书编号[：:]\s*([^\n,，\s）)]{4,30})/) ||
      eFirst(text, /责任认定书[：:]\s*([^\n,，\s）)]{4,30})/) || "___",

    // Liability: capture the liability term itself
    defendant1_liability:
      eFirst(text, /被告[\s\S]{0,400}?(全责|全部责任|主要责任|主责)/) ||
      eFirst(text, /被告[\s\S]{0,400}?责任[：:]\s*([^\n,，.。]{2,20})/) || "___",
    plaintiff_liability:
      eFirst(text, /原告[\s\S]{0,400}?(次要责任|次责|无责|不承担责任)/) ||
      eFirst(text, /原告[\s\S]{0,400}?责任[：:]\s*([^\n,，.。]{2,20})/) || "___",

    treat_hospital:
      eFirst(text, /(?:就诊|治疗)医院[：:]\s*([^\n,，]{4,30})/) ||
      eFirst(text, /(?:送往|经送|送至|送到|在|于)([^\n,，]{2,20}(?:医院|卫生院|医疗中心))(?:住院|就医|就诊|治疗)/) ||
      eFirst(text, /([^\n,，]{2,20}(?:医院|卫生院|医疗中心))(?:就诊|住院|进行治疗)/) || "___",
    // AI may write "诊断为：" instead of "诊断："
    injury_diagnosis:
      eFirst(text, /(?:伤情)?诊断为?[：:]\s*([^\n,，.。]{4,60})/) || "___",
    hospital_days: e(text, /住院[：:\s]*(\d+)\s*(?:天|日)/),

    court_name:
      eFirst(text, /向([^\n,，]{2,20}(?:法院|法庭))(?:提起|递交|起诉)/) ||
      eFirst(text, /([^\n,，]{2,20}人民法院)/) || "___",

    // AI may write "具状人：" instead of "签名："
    plaintiff_signature:
      eFirst(text, /具状人[：:]\s*([^\n,，]{2,20})/) ||
      eFirst(text, /原告[\s\S]{0,600}?(?:签名|签字)[：:]\s*([^\n,，]{2,20})/) || "___",

    file_year:  String(today.getFullYear()),
    file_month: String(today.getMonth() + 1),
    file_day:   String(today.getDate()),
  };
}

function extractEvidence(text: string): FieldMap {
  return {
    case_no:               e(text, /案号[：:]\s*([^\n,，]{4,30})/),
    plaintiff_name_evid:   e(text, /原告[：:\s]*([^\n,，（(\d]{2,15})/),
    defendant1_name_evid:  e(text, /被告(?:一|1|（一）)?[：:\s]*([^\n,，（(\d]{2,15})/),
    defendant2_company_evid: e(text, /(?:保险公司|被告二)[：:\s]*([^\n,，（(\d]{4,30})/),
    evidence_pages:        e(text, /(?:总)?页数[：:]\s*(\d+)/) || "___",
    submitter:             e(text, /提交人[：:]\s*([^\n,，]{2,20})/),
    submit_date:           e(text, /提交(?:日期)?[：:]\s*([^\n,，]{4,30})/),
    court_name_evid:       e(text, /([^\n,，]{2,20}(?:人民法院|法院))/),
  };
}

export function extractDocFields(rawText: string, docType: DocType): FieldMap {
  const text = cleanText(rawText);
  switch (docType) {
    case "和解协议":  return extractSettlement(text);
    case "民事起诉状": return extractComplaint(text);
    case "证据目录":  return extractEvidence(text);
  }
}
