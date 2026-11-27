(() => {
  'use strict';

  const assumptions = [
    '同一家系研究同一单基因性状', '完全外显', '无新突变', '无表型误判', '亲缘关系已知',
    '常染色体按二倍体、伴X按XX或XY及X非同源区处理', '配子等概率且随机结合',
    '男女机会相等且无存活选择', '给定父母基因型和模型条件时各次生育相互独立'
  ];
  const member = (id, sex, phenotype, x, generation, extra = {}) =>
    ({ id, sex, phenotype, x, generation, ...extra });
  const family = (id, father, mother, children) => ({ id, father, mother, children });
  const cases = [
    {
      id: 'P01', version: 1, title: '从两段亲子关系判读', locus: 'unknown',
      people: [
        member('I-1', 'M', 'affected', 140, 1), member('I-2', 'F', 'affected', 240, 1),
        member('II-1', 'F', 'unaffected', 80, 2), member('II-2', 'M', 'affected', 220, 2),
        member('II-3', 'F', 'unaffected', 330, 2),
        member('III-1', 'M', 'affected', 220, 3), member('III-2', 'F', 'unaffected', 330, 3)
      ],
      families: [family('F1', 'I-1', 'I-2', ['II-1', 'II-2']), family('F2', 'II-2', 'II-3', ['III-1', 'III-2'])],
      target: ['II-2', 'II-3'], asks: ['方式判读', 'II-2与II-3下一子代受累概率']
    },
    {
      id: 'P02', version: 2, title: '四名同胞与携带证据', locus: 'unknown',
      people: [
        member('I-1', 'M', 'unaffected', 190, 1), member('I-2', 'F', 'unaffected', 290, 1),
        member('II-1', 'F', 'affected', 80, 2), member('II-2', 'M', 'unaffected', 185, 2),
        member('II-3', 'M', 'affected', 290, 2),
        member('II-4', 'F', 'unaffected', 395, 2, { carrier: true })
      ],
      families: [family('F1', 'I-1', 'I-2', ['II-1', 'II-2', 'II-3', 'II-4'])],
      target: ['I-1', 'I-2'], carrierTarget: 'II-2',
      asks: ['方式判读', 'I-1与I-2下一子代受累概率', '双亲Aa×Aa且II-2未受累时II-2的携带概率']
    },
    {
      id: 'P03', version: 1, title: 'X定位下的显隐性判读', locus: 'X',
      people: [
        member('I-1', 'M', 'affected', 245, 1), member('I-2', 'F', 'unaffected', 350, 1),
        member('II-1', 'M', 'unaffected', 95, 2), member('II-2', 'F', 'affected', 205, 2),
        member('II-3', 'M', 'unaffected', 395, 2),
        member('III-1', 'F', 'affected', 95, 3), member('III-2', 'M', 'unaffected', 205, 3)
      ],
      families: [family('F1', 'I-1', 'I-2', ['II-2', 'II-3']), family('F2', 'II-1', 'II-2', ['III-1', 'III-2'])],
      target: ['II-1', 'II-2'], asks: ['方式判读', 'II-1与II-2下一子代受累概率']
    },
    {
      id: 'P04', version: 1, title: '条件概率与受累男孩', locus: 'X',
      people: [
        member('I-1', 'M', 'affected', 245, 1), member('I-2', 'F', 'unaffected', 350, 1),
        member('II-1', 'M', 'unaffected', 95, 2), member('II-2', 'F', 'unaffected', 205, 2),
        member('II-3', 'M', 'unaffected', 395, 2),
        member('III-1', 'M', 'affected', 95, 3), member('III-2', 'F', 'unaffected', 205, 3)
      ],
      families: [family('F1', 'I-1', 'I-2', ['II-2', 'II-3']), family('F2', 'II-1', 'II-2', ['III-1', 'III-2'])],
      target: ['II-1', 'II-2'],
      asks: ['方式判读', 'II-1与II-2已知下一子代为男孩时受累概率', 'II-1与II-2下一子代为受累男孩概率']
    },
    {
      id: 'P05', version: 1, title: '多个模型与外来配偶未知', locus: 'unknown',
      people: [
        member('I-1', 'M', 'affected', 135, 1), member('I-2', 'F', 'unaffected', 245, 1),
        member('II-1', 'F', 'affected', 100, 2), member('II-2', 'M', 'unaffected', 245, 2),
        member('II-3', 'F', 'unaffected', 365, 2), member('III-1', 'F', 'unknown', 305, 3)
      ],
      families: [family('F1', 'I-1', 'I-2', ['II-1', 'II-2']), family('F2', 'II-2', 'II-3', ['III-1'])],
      target: ['II-2', 'II-3'], asks: ['方式判读', 'II-2与II-3下一子代受累概率及所缺信息']
    },
    {
      id: 'P06', version: 1, title: '两处关系中的冲突', locus: 'unknown',
      people: [
        member('I-1', 'M', 'affected', 160, 1), member('I-2', 'F', 'affected', 270, 1),
        member('II-1', 'M', 'unaffected', 215, 2), member('II-2', 'F', 'unaffected', 345, 2),
        member('III-1', 'F', 'affected', 280, 3)
      ],
      families: [family('F1', 'I-1', 'I-2', ['II-1']), family('F2', 'II-1', 'II-2', ['III-1'])],
      target: ['II-1', 'II-2'], asks: ['方式判读', '冲突关系与违反的条件']
    }
  ];

  function freeze(value) {
    Object.values(value).forEach(item => { if (item && typeof item === 'object') freeze(item); });
    return Object.freeze(value);
  }
  window.MasterLabPedigreeCases = freeze({ assumptions, cases });
})();
