export type DocType = "和解协议" | "民事起诉状" | "证据目录";

type FieldMap = Record<string, string>;

function e(text: string, pattern: RegExp, fallback = "___"): string {
  const m = text.match(pattern);
  const val = m ? (m[1] ?? "").trim().replace(/\*+/g, "").trim() : "";
  return val || fallback;
}

function cleanText(rawText: string): string {
  return rawText
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/<data>[\s\S]*?<\/data>/g, "");
}

function extractSettlement(text: string): FieldMap {
  const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const timeMatch = text.match(/(\d{1,2})[时:](\d{2})?分?/);
  const signDateMatch = text.match(/签(?:订|署|字)[\s\S]*?(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const today = new Date();

  return {
    party_a_name: e(text, /甲方[（(]?赔偿方[）)]?[：:\s]*[\s\S]{0,10}?姓名[：:]\s*([^\n,，]+)/) ||
      e(text, /甲方[（(]?赔偿方[）)]?[：:]\s*([^\n（(,，\d]{2,15})/),
    party_a_nation: e(text, /甲方[\s\S]{0,120}?民族[：:]\s*([^\n,，]{1,10})/),
    party_a_id: e(text, /甲方[\s\S]{0,200}?身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    party_a_address: e(text, /甲方[\s\S]{0,250}?(?:住(?:所|址)|地址)[：:]\s*([^\n,，]{4,60})/),
    party_b_name: e(text, /乙方[（(]?受偿方[）)]?[：:\s]*[\s\S]{0,10}?姓名[：:]\s*([^\n,，]+)/) ||
      e(text, /乙方[（(]?受偿方[）)]?[：:]\s*([^\n（(,，\d]{2,15})/),
    party_b_nation: e(text, /乙方[\s\S]{0,120}?民族[：:]\s*([^\n,，]{1,10})/),
    party_b_id: e(text, /乙方[\s\S]{0,200}?身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    party_b_address: e(text, /乙方[\s\S]{0,250}?(?:住(?:所|址)|地址)[：:]\s*([^\n,，]{4,60})/),
    accident_date: dateMatch?.[1] ?? "___",
    accident_month: dateMatch?.[2] ?? "___",
    accident_day: dateMatch?.[3] ?? "___",
    accident_time: timeMatch ? `${timeMatch[1]}时${timeMatch[2] ?? "00"}分` : "___",
    accident_location: e(text, /(?:事故)?地点[：:]\s*([^\n,，]{4,60})/) ||
      e(text, /发生(?:于|在)\s*([^\n,，]{4,50})/),
    car_a_plate: e(text, /甲方[\s\S]{0,350}?(?:车牌|号牌)[：:]\s*([^\n,，\s]{5,12})/),
    car_a_type: e(text, /甲方[\s\S]{0,350}?车(?:辆)?(?:类型|型)[：:]\s*([^\n,，]{2,20})/),
    car_b_plate: e(text, /乙方[\s\S]{0,350}?(?:车牌|号牌)[：:]\s*([^\n,，\s]{5,12})/),
    car_b_type: e(text, /乙方[\s\S]{0,350}?车(?:辆)?(?:类型|型)[：:]\s*([^\n,，]{2,20})/),
    party_a_liability: e(text, /甲方[\s\S]{0,450}?(?:责任比例?|责任)[：:]\s*([^\n,，.。]{2,20})/),
    party_b_liability: e(text, /乙方[\s\S]{0,450}?(?:责任比例?|责任)[：:]\s*([^\n,，.。]{2,20})/),
    medical_fee_paid: e(text, /医疗费(?:（已支出）)?[：:]\s*([\d,.]+)\s*元/),
    medical_fee_future: e(text, /(?:预期|后续)医疗费[：:]\s*([\d,.]+)\s*元/),
    car_a_repair: e(text, /甲方[\s\S]{0,400}?(?:车辆)?维修费[：:]\s*([\d,.]+)\s*元/),
    car_a_bear: e(text, /甲方[\s\S]{0,400}?(?:自行)?承担[：:]\s*([\d,.]+)\s*元/),
    car_b_repair: e(text, /乙方[\s\S]{0,400}?(?:车辆)?维修费[：:]\s*([\d,.]+)\s*元/),
    car_b_bear: e(text, /乙方[\s\S]{0,400}?(?:自行)?承担[：:]\s*([\d,.]+)\s*元/),
    lost_income: e(text, /误工费[：:]\s*([\d,.]+)\s*元/),
    transport_fee: e(text, /交通费[：:]\s*([\d,.]+)\s*元/),
    other_fee_total: e(text, /其他(?:合理)?费用[：:]\s*([\d,.]+)\s*元/),
    other_fee_total_cn: e(text, /其他费用.*?[（(]([^）)]+)[）)]/),
    payment_deadline: e(text, /付款(?:期限|截止日期?)[：:]\s*([^\n,，.。]{4,30})/),
    total_compensation: e(text, /(?:赔偿)?(?:总额|合计|总计)[：:]\s*([\d,.]+)\s*元/) ||
      e(text, /共计\s*([\d,.]+)\s*元/),
    total_compensation_cn: e(text, /(?:总额|合计|总计).*?[（(]([^）)]+)[）)]/) ||
      e(text, /共计[\d,.]+元[（(]([^）)]+)[）)]/),
    bank_account_name: e(text, /开户名(?:称)?[：:]\s*([^\n,，]{2,30})/),
    bank_account_owner: e(text, /账户(?:持有人|所有人)[：:]\s*([^\n,，]{2,30})/),
    bank_name: e(text, /开户行[：:]\s*([^\n,，]{4,40})/),
    bank_account_no: e(text, /(?:银行)?账号[：:]\s*([\d\s]{10,30})/),
    party_a_sign: e(text, /甲方[\s\S]{0,500}?(?:签名|签字)[：:]\s*([^\n,，]{2,20})/),
    party_b_sign: e(text, /乙方[\s\S]{0,500}?(?:签名|签字)[：:]\s*([^\n,，]{2,20})/),
    sign_date: signDateMatch
      ? `${signDateMatch[1]}年${signDateMatch[2]}月${signDateMatch[3]}日`
      : `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月${String(today.getDate()).padStart(2, "0")}日`,
  };
}

function extractComplaint(text: string): FieldMap {
  const accDate = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:[^时\n]*?(\d{1,2})[时:](\d{2})?)?/);
  const today = new Date();

  return {
    plaintiff_name: e(text, /原告[：:\s]*([^\n,，（(\d]{2,15})/),
    plaintiff_gender: e(text, /原告[\s\S]{0,80}?性别[：:]\s*(男|女)/),
    plaintiff_nation: e(text, /原告[\s\S]{0,100}?民族[：:]\s*([^\n,，]{1,10})/),
    plaintiff_id_no: e(text, /原告[\s\S]{0,200}?身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    plaintiff_address: e(text, /原告[\s\S]{0,250}?(?:住(?:所|址)|地址)[：:]\s*([^\n,，]{4,60})/),
    plaintiff_phone: e(text, /原告[\s\S]{0,250}?(?:电话|联系方式)[：:]\s*([\d\-\s]{7,15})/),
    defendant1_name: e(text, /被告(?:一|1|（一）)?[：:\s]*([^\n,，（(\d]{2,15})/),
    defendant1_gender: e(text, /被告(?:一|1)?[\s\S]{0,100}?性别[：:]\s*(男|女)/),
    defendant1_nation: e(text, /被告(?:一|1)?[\s\S]{0,120}?民族[：:]\s*([^\n,，]{1,10})/),
    defendant1_id_no: e(text, /被告(?:一|1)?[\s\S]{0,200}?身份证(?:号(?:码)?)?[：:]\s*([\dXx]{15,18})/),
    defendant1_address: e(text, /被告(?:一|1)?[\s\S]{0,250}?(?:住(?:所|址)|地址)[：:]\s*([^\n,，]{4,60})/),
    defendant1_phone: e(text, /被告(?:一|1)?[\s\S]{0,250}?(?:电话|联系方式)[：:]\s*([\d\-\s]{7,15})/),
    defendant2_company: e(text, /(?:保险公司|被告二|被告(?:（二）)?)[：:\s]*([^\n,，（(\d]{4,30}保险[^\n,，]{0,10})/),
    defendant2_credit_code: e(text, /统一社会信用代码[：:]\s*([^\n,，\s]{15,20})/),
    defendant2_address: e(text, /保险公司[\s\S]{0,200}?地址[：:]\s*([^\n,，]{4,60})/),
    defendant2_principal: e(text, /(?:法定代表人|负责人)[：:]\s*([^\n,，]{2,15})/),
    defendant2_phone: e(text, /保险公司[\s\S]{0,250}?(?:电话|联系)[：:]\s*([\d\-\s]{7,15})/),
    medical_fee: e(text, /医疗费[：:]\s*([\d,.]+)\s*元/),
    food_fee: e(text, /(?:住院)?伙食(?:补助)?费[：:]\s*([\d,.]+)\s*元/),
    nutrition_fee: e(text, /营养费[：:]\s*([\d,.]+)\s*元/),
    nursing_fee: e(text, /护理费[：:]\s*([\d,.]+)\s*元/),
    lost_income: e(text, /误工费[：:]\s*([\d,.]+)\s*元/),
    transport_fee: e(text, /交通费[：:]\s*([\d,.]+)\s*元/),
    disability_compensation: e(text, /残疾赔偿金[：:]\s*([\d,.]+)\s*元/),
    mental_damage: e(text, /精神损害(?:抚慰金)?[：:]\s*([\d,.]+)\s*元/),
    appraisal_fee: e(text, /鉴定费[：:]\s*([\d,.]+)\s*元/),
    car_repair_fee: e(text, /车辆维修费[：:]\s*([\d,.]+)\s*元/),
    other_loss: e(text, /其他(?:损失|费用)[：:]\s*([\d,.]+)\s*元/),
    total_compensation: e(text, /(?:合计|总计|共计|赔偿总额)[：:]\s*([\d,.]+)\s*元/),
    total_compensation_cn: e(text, /(?:合计|总计|共计)[\d,.]+元[（(]([^）)]+)[）)]/),
    accident_year: accDate?.[1] ?? String(today.getFullYear()),
    accident_month: accDate?.[2] ?? "___",
    accident_day: accDate?.[3] ?? "___",
    accident_hour: accDate?.[4] ?? "___",
    accident_minute: accDate?.[5] ?? "00",
    accident_location: e(text, /(?:事故)?地点[：:]\s*([^\n,，]{4,60})/),
    defendant1_car_plate: e(text, /被告(?:一|1)?[\s\S]{0,400}?(?:车牌|号牌)[：:]\s*([^\n,，\s]{5,12})/),
    plaintiff_car_plate: e(text, /原告[\s\S]{0,400}?(?:车牌|号牌)[：:]\s*([^\n,，\s]{5,12})/),
    police_dept: e(text, /交警(?:大队|支队|局)[：:\s]*([^\n,，]{4,30})/),
    police_branch: e(text, /交警(?:中队|分队)[：:\s]*([^\n,，]{4,30})/),
    accident_certificate_no: e(text, /责任认定书(?:编号)?[：:]\s*([^\n,，\s]{4,30})/),
    defendant1_liability: e(text, /被告(?:一|1)?[\s\S]{0,500}?(?:主要)?责任[：:]\s*([^\n,，.。]{2,30})/),
    plaintiff_liability: e(text, /原告[\s\S]{0,500}?(?:次要)?责任[：:]\s*([^\n,，.。]{2,30})/),
    treat_hospital: e(text, /(?:就诊|治疗)医院[：:]\s*([^\n,，]{4,30})/) ||
      e(text, /在([^\n,，]{2,20}(?:医院|卫生院|医疗中心))(?:住院|就医|治疗)/),
    injury_diagnosis: e(text, /(?:伤情)?诊断[：:]\s*([^\n,，.。]{4,60})/),
    hospital_days: e(text, /住院(\d+)\s*(?:天|日)/),
    court_name: e(text, /向([^\n,，]{2,20}(?:法院|法庭))(?:提起|递交|起诉)/) ||
      e(text, /([^\n,，]{2,20}(?:人民法院|法院))/),
    plaintiff_signature: e(text, /原告[\s\S]{0,600}?(?:签名|签字)[：:]\s*([^\n,，]{2,20})/),
    file_year: String(today.getFullYear()),
    file_month: String(today.getMonth() + 1),
    file_day: String(today.getDate()),
  };
}

function extractEvidence(text: string): FieldMap {
  return {
    case_no: e(text, /案号[：:]\s*([^\n,，]{4,30})/),
    plaintiff_name_evid: e(text, /原告[：:\s]*([^\n,，（(\d]{2,15})/),
    defendant1_name_evid: e(text, /被告(?:一|1|（一）)?[：:\s]*([^\n,，（(\d]{2,15})/),
    defendant2_company_evid: e(text, /(?:保险公司|被告二)[：:\s]*([^\n,，（(\d]{4,30})/),
    evidence_pages: e(text, /(?:总)?页数[：:]\s*(\d+)/) || "___",
    submitter: e(text, /提交人[：:]\s*([^\n,，]{2,20})/),
    submit_date: e(text, /提交(?:日期)?[：:]\s*([^\n,，]{4,30})/),
    court_name_evid: e(text, /([^\n,，]{2,20}(?:人民法院|法院))/),
  };
}

export function extractDocFields(rawText: string, docType: DocType): FieldMap {
  const text = cleanText(rawText);
  switch (docType) {
    case "和解协议": return extractSettlement(text);
    case "民事起诉状": return extractComplaint(text);
    case "证据目录": return extractEvidence(text);
  }
}
