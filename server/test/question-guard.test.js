import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// physics-extra.js 只依赖 window 与 ScienceMotion（绘图时），解析部分可以直接在 Node 中测试
const source = await readFile(new URL('../../web/physics-extra.js', import.meta.url), 'utf8');
const sandbox = { ScienceMotion: { circuitMarkup: () => '' } };
sandbox.window = sandbox;
vm.runInNewContext(source, sandbox);
const guard = sandbox.MasterLabQuestionGuard;
const templates = sandbox.EXTRA_PHYSICS_TEMPLATES;
// vm 里的数组与本进程不是同一个 Array，比较前转成普通 JSON
const quantities = text => JSON.parse(JSON.stringify(guard.extractQuantities(text).map(token => [token.cls, Number(token.value.toPrecision(6))])));

test('guard: units, scientific notation, g and coefficients become comparable quantities', () => {
  assert.deepEqual(quantities('汽车以 72km/h 的速度行驶，加速度大小为 5m/s²'), [['speed', 20], ['accel', 5]]);
  assert.deepEqual(quantities('ρ水=1.0×10³kg/m³，排开 200cm³，g 取 10N/kg'), [['density', 1000], ['volume', 200], ['g', 10]]);
  assert.deepEqual(quantities('取 g=10m/s²，动摩擦因数μ=0.25'), [['g', 10], ['coef', 0.25]]);
  assert.deepEqual(quantities('电流为 200mA，电阻 R1=4Ω'), [['current', 0.2], ['resistance', 4]]);
  assert.deepEqual(quantities('木块有 1/3 露出水面'), [['fraction', 0.333333]]);
  assert.deepEqual(quantities('承担物重的绳子有三段'), [['count', 3]]);
});

test('guard: every stated quantity must be used by the template', () => {
  const used = [{ cls: 'speed', value: 20 }, { cls: 'accel', value: 5, abs: true }];
  assert.equal(guard.unconsumed('汽车以 20m/s 行驶，加速度为 -5m/s²，求刹车距离', used).length, 0);
  assert.equal(guard.unconsumed('汽车以 20m/s 行驶，加速度为 5m/s²，求刹车后 2s 内的位移', used)[0].text, '2s');
});

test('guard: asked items are checked one by one', () => {
  const supported = /落地时间|水平位移/;
  assert.equal(guard.checkAsks('求落地时间和水平位移，并观察运动轨迹。', supported).ok, true);
  assert.equal(guard.checkAsks('求落地时间和落地速度。', supported).ok, false);
  assert.equal(guard.checkAsks('求滑块和木板的加速度。', /加速度/).ok, true);
});

test('extra templates: every built-in question parses back to the same values', () => {
  for (const [id, template] of Object.entries(templates)) {
    for (const example of template.examples) {
      const result = template.parseQuestion(example.question);
      assert.equal(result.ok, true, `${id}: ${example.question} → ${result.message}`);
      assert.equal(result.p1, example.p1, id);
      assert.equal(result.p2, example.p2, id);
    }
  }
});

test('extra templates: missing, out-of-range or contradicting conditions are never filled in', () => {
  const misses = [
    ['efficiency', '用滑轮组提升重 400N 的物体，拉力为 150N，求机械效率。'],
    ['efficiency', '用滑轮组提升重 400N 的物体，拉力 250N，承担物重的绳子有 2 段，求机械效率。'],
    ['seriesCircuit', 'R1=6Ω 和 R2=3Ω 并联接在 6V 电源上，求干路电流。'],
    ['heatBalance', '质量为 2kg 的水温度从 20℃ 升高到 70℃，吸收多少热量？'],
    ['lever', '杠杆平衡时，动力为 10N，动力臂为 20cm，阻力臂为 40cm，求阻力。'],
    ['friction', '重 10N 的木块放在水平桌面上，用 3N 的力匀速拉动，求摩擦力。'],
    ['buoyancy', '木块漂浮在水面上，体积为 200cm³，求浮力。'],
    ['buoyancy', '一个物体浸入盐水后排开 300mL 盐水，求浮力。'],
    ['liquidPressure', '水深 5m 处水产生的压强是多少？'],
    ['lens', '凸透镜焦距 10cm，物距 30cm，物体高 4cm，求像高。'],
    ['lampPower', '额定电压为 3.8V 的小灯泡正常发光时电流为 0.3A，求额定功率。'],
    ['sound', '频率为 680Hz 的声波在空气中的波长是多少？']
  ];
  for (const [id, question] of misses) {
    assert.equal(templates[id].parseQuestion(question).ok, false, `${id} should refuse: ${question}`);
  }
});

test('extra templates: textbook values and constants from the question are used as given', () => {
  const series = templates.seriesCircuit.parseQuestion('电源电压为 9V，电阻 R1=5Ω 与 R2=10Ω 串联，求电路中的电流。');
  assert.equal(series.ok, true);
  assert.equal(series.fixed.r1, 5);
  assert.ok(Math.abs(templates.seriesCircuit.model(series.p1, series.p2, series.fixed).metrics[2] - 0.6) < 1e-9);

  const pulley = templates.efficiency.parseQuestion('用滑轮组把重 500N 的物体提升 2m，拉力为 200N，绳子自由端移动 6m，求机械效率。');
  assert.equal(pulley.ok, true);
  assert.ok(Math.abs(templates.efficiency.model(pulley.p1, pulley.p2, pulley.fixed).metrics[2] - 500 / 6) < 1e-9);
  const params = templates.efficiency.content(pulley.p1, pulley.p2, pulley.fixed).params;
  assert.ok(params[0].max >= 500 && params[1].max >= 200, 'slider ranges include the textbook values');

  const buoyancy = templates.buoyancy.parseQuestion('一个木块浸没在水中，排开水的体积为 200cm³，求它受到的浮力。（g 取 10N/kg）');
  assert.equal(buoyancy.ok, true);
  assert.ok(Math.abs(templates.buoyancy.model(buoyancy.p1, buoyancy.p2, buoyancy.fixed).metrics[2] - 2) < 1e-9);

  const lamp = templates.lampPower.parseQuestion('额定电压为 2.5V 的小灯泡，两端电压为 2V 时电流为 0.28A，求实际功率并判断亮度。');
  assert.equal(lamp.ok, true);
  assert.equal(templates.lampPower.model(lamp.p1, lamp.p2, lamp.fixed).facts[2].value, '比正常发光暗');
});

// 显示：能精确写出的结果不四舍五入；除不尽的结果写“≈”；第一步列出题目给出的全部已知量
const contentOf = (id, question) => {
  const parsed = templates[id].parseQuestion(question);
  assert.equal(parsed.ok, true, `${id}: ${question} → ${parsed.message}`);
  return templates[id].content(parsed.p1, parsed.p2, parsed.fixed);
};

test('extra templates: exact results keep every digit, rounded results are marked with ≈', () => {
  const buoyancy = contentOf('buoyancy', '一个木块浸没在水中，排开水的体积为 125cm³，求它受到的浮力。（g 取 10N/kg）');
  assert.equal(buoyancy.model.readout, 'F浮 = 1.25N');

  const friction = contentOf('friction', '木块对水平木板的压力为 12.5N，动摩擦因数为 0.25，求木块滑动时受到的滑动摩擦力。');
  assert.equal(friction.model.readout, 'f = 3.125N');

  const series = contentOf('seriesCircuit', '电源电压为 6V，电阻 R1=4Ω 与 R2=5Ω 串联，求电路中的电流。');
  assert.equal(series.model.readout, 'I ≈ 0.667A');
  assert.match(series.model.formulaDetail, /≈ 0\.667 A$/);

  const pulley = contentOf('efficiency', '用滑轮组把重 500N 的物体提升 2m，拉力为 200N，绳子自由端移动 6m，求机械效率。');
  assert.equal(pulley.model.readout, 'η ≈ 83.3%');

  const exactPulley = contentOf('efficiency', '用滑轮组提升重 480N 的物体，拉力为 200N，承担物重的绳子有 3 段，求机械效率。');
  assert.equal(exactPulley.model.readout, 'η = 80%');

  const sound = contentOf('sound', '声源频率为 400Hz，振幅为 60%。按空气中声速约 340m/s，估算波长。');
  assert.equal(sound.model.readout, 'λ = 0.85m');
});

test('extra templates: the first step lists every given quantity, not only the two sliders', () => {
  const heat = contentOf('heatBalance', '将 100g、80℃ 的热水与 300g、20℃ 的冷水混合，不计热量损失，求混合后的温度。');
  assert.match(heat.steps[0][1], /冷水 m₂ = 300g、t₂ = 20℃/);

  const series = contentOf('seriesCircuit', '电源电压为 9V，电阻 R1=5Ω 与 R2=10Ω 串联，求电路中的电流。');
  assert.match(series.steps[0][1], /R₁ = 5Ω，R₂ = 10Ω/);

  const lamp = contentOf('lampPower', '小灯泡两端电压为 3V，通过的电流为 0.32A，求小灯泡的实际功率。');
  assert.match(lamp.steps[0][1], /未给出额定电压/);
  assert.equal(lamp.model.facts[2].value, '无法判断');
});

// 第二轮独立核查（2026-10-07）：题目条件与模板不符时交给 AI；铭牌、金属块、所问的量按题意展示
test('extra templates: nameplates, named metals and asked quantities follow the question', () => {
  const nameplate = contentOf('lampPower', '标有“2.5V 0.3A”字样的小灯泡正常发光时，它的电功率是多少？');
  assert.match(nameplate.steps[0][1], /铭牌：额定电压 2\.5V、额定电流 0\.3A/);
  assert.equal(nameplate.model.readout, 'P = 0.75W');
  assert.match(nameplate.model.conclusion, /正常发光，等于额定功率/);

  const aluminium = contentOf('buoyancy', '体积为 250cm³ 的铝块浸没在水中，g 取 10N/kg，求铝块受到的浮力。');
  assert.equal(aluminium.model.readout, 'F浮 = 2.5N');
  assert.match(aluminium.model.conclusion, /铝块重 G = ρ铝gV = 6\.75N/);
  assert.match(aluminium.model.conclusion, /F示 = 4\.25N/);

  const wood = contentOf('buoyancy', '一个木块浸没在水中，排开水的体积为 200cm³，求它受到的浮力。（g 取 10N/kg）');
  assert.match(wood.model.conclusion, /演示中假设物重/);

  const heat = contentOf('heatBalance', '将 0.2kg、75℃ 的热水与 0.3kg、25℃ 的冷水混合，不计热量损失，求冷水吸收的热量。');
  assert.match(heat.model.conclusion, /Q吸 = Q放 = 2\.52×10⁴ J/);
});

test('extra templates: conditions outside the drawn model are handed to AI', () => {
  const refusals = [
    ['lampPower', '标有“2.5V 0.3A”字样的小灯泡两端电压为 2V 时，它的实际功率是多少？'],
    ['lever', '杠杆右侧挂 6N 重物，阻力臂为 20cm。在左侧距支点 30cm 处用弹簧测力计斜向下拉，拉力为 4N，判断杠杆是否平衡。'],
    ['seriesCircuit', 'R1=6Ω 与 R2=4Ω 串联接在 5V 电源上，电压表测 R1 两端的电压，求电压表的示数。'],
    ['sound', '声源频率为 440Hz，振幅为 50%，若频率提高到原来的 2 倍，音调将如何变化？'],
    ['heatBalance', '将 100g、90℃ 的热水与 300g、10℃ 的冷水混合，不计热量损失，热水的温度降低了多少？'],
    ['efficiency', '用承担物重的绳子段数 n=3 的滑轮组提升重 100N 的物体，绳端拉力为 30N，求机械效率。'],
    ['buoyancy', '体积为 250cm³ 的空心铝球浸没在水中，g 取 10N/kg，求它受到的浮力。']
  ];
  for (const [id, question] of refusals) {
    assert.equal(templates[id].parseQuestion(question).ok, false, `${id} should refuse: ${question}`);
  }
});
