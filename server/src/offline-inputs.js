// Keep the four strict parsers in parity with LocalQuestionParser.ets.
// Incomplete or unsupported problems must not become fabricated/clamped inputs.
function quantity(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    const unit = (match[2] || '').toLowerCase().replace(/\s/g, '');
    if (Number.isFinite(value)) return unit === 'km/h' || unit === '千米每小时' ? value / 3.6 :
      unit === 'kg' || unit === '千克' ? value * 1000 : value;
  }
  return NaN;
}

export function offlineInputs(question, templateId) {
  if (templateId === 'brake') {
    const initialSpeed = quantity(question, [
      /(?:初速度|v[0₀])\s*(?:为|是|=|：|:)?\s*([+-]?\d+(?:\.\d+)?)\s*(km\s*\/\s*h|m\s*\/\s*s|千米每小时|米每秒)/i,
      /(?:汽车|车辆|小车)\s*以\s*([+-]?\d+(?:\.\d+)?)\s*(km\s*\/\s*h|m\s*\/\s*s|千米每小时|米每秒)/i,
      /(?:^|[，,；;\s])速度\s*(?:为|是|=|：|:)?\s*([+-]?\d+(?:\.\d+)?)\s*(km\s*\/\s*h|m\s*\/\s*s|千米每小时|米每秒)/i
    ]);
    const deceleration = Math.abs(quantity(question, [
      /(?:减速度(?:大小)?|加速度(?:大小)?|a)\s*(?:为|是|=|：|:)?\s*([+-]?\d+(?:\.\d+)?)\s*(m\s*\/\s*s(?:²|2|\^2)|米每秒平方)/i
    ]));
    return bounded({ initialSpeed, deceleration }, [[5, 40], [1, 12]]);
  }
  if (templateId === 'fe_cuso4') {
    const ironMass = quantity(question, [
      /(?:铁粉?|Fe)\s*(?:的)?\s*(?:质量)?\s*(?:为|是|=)?\s*(\d+(?:\.\d+)?)\s*(kg|g|千克|克)/i,
      /(\d+(?:\.\d+)?)\s*(kg|g|千克|克)\s*(?:的)?\s*(?:铁粉?|Fe)/i
    ]);
    const copper = quantity(question, [
      /(?:硫酸铜|CuSO[4₄])\s*(?:溶液)?\s*(?:的)?\s*(?:质量|物质的量)?\s*(?:为|是|=)?\s*(\d+(?:\.\d+)?)\s*(mol|kg|g|千克|克)/i,
      /(\d+(?:\.\d+)?)\s*(mol|kg|g|千克|克)\s*(?:的)?\s*(?:硫酸铜|CuSO[4₄])/i
    ]);
    const molarCopper = quantity(question, [
      /(?:硫酸铜|CuSO[4₄])\s*(?:溶液)?\s*(?:的)?\s*(?:物质的量)?\s*(?:为|是|=)?\s*(\d+(?:\.\d+)?)\s*(mol)/i,
      /(\d+(?:\.\d+)?)\s*(mol)\s*(?:的)?\s*(?:硫酸铜|CuSO[4₄])/i
    ]);
    if (/硫酸铜溶液/.test(question) && !Number.isFinite(molarCopper)) return null;
    return bounded({ ironMass, copperSulfateMass: Number.isFinite(molarCopper) ? molarCopper * 160 : copper }, [[0.5, 30], [1, 80]]);
  }
  if (templateId === 'tangent') {
    const expression = question.replace(/\s/g, '').match(/(?:y|f\(x\))=([+-]?(?:\d+(?:\.\d+)?)?)x(?:\^2|²)(?![\d.+\-*/x])/i);
    const coefficient = !expression ? NaN : expression[1] === '' || expression[1] === '+' ? 1 :
      expression[1] === '-' ? -1 : Number(expression[1]);
    const pointX = quantity(question, [/(?:切点(?:横坐标)?|横坐标|x[0₀]?)\s*(?:为|是|=|：|:)\s*([+-]?\d+(?:\.\d+)?)/i]);
    return bounded({ coefficient, pointX }, [[0.25, 3], [-3, 3]]);
  }
  if (templateId === 'cell' && /植物|动物/.test(question)) return { cellType: question.includes('植物') ? 1 : 0 };
  return null;
}

function bounded(values, ranges) {
  return Object.values(values).every((value, i) => Number.isFinite(value) && value >= ranges[i][0] && value <= ranges[i][1])
    ? values : null;
}
