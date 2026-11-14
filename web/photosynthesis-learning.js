/* A learning draft belongs to the mounted scene, outside experiment and share data. */
(() => {
  'use strict';
  const groups = ['强光', '中光', '弱光'];
  const drafts = new WeakMap();
  const countValue = value => /^(?:[0-9]|10)$/.test(value) ? Number(value) : null;
  const validMinutes = value => /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(value)
    && Number(value) > 0 && Number(value) <= 1440;
  const option = (value, label) => '<option value="'+value+'">'+label+'</option>';
  const select = (name, label, options) => '<label>'+label+'<select data-learning="'+name+'">'
    + option('', '请选择') + options.map(([value, caption]) => option(value, caption)).join('') + '</select></label>';
  const input = (name, label) => '<input type="text" inputmode="numeric" maxlength="4" data-learning="'+name+'" aria-label="'+label+'">';
  const colors = [['blue','变蓝'], ['plain','不变蓝']];

  function mount(scene, senior) {
    const prediction = document.createElement('section');
    prediction.className = 'photo-learning';
    prediction.innerHTML = '<h4>1. 我的预测</h4><p>可选。开始操作后，本轮预测锁定。</p><fieldset data-predictions>'
      + (senior ? groups.map((g, i) => '<label>'+g+'预计浮起数（0–10）'+input('predict'+i, g+'预测浮起数')+'</label>').join('')
        : select('predict0','原见光区',colors) + select('predict1','原遮光区',colors))
      + '</fieldset><p>2. 操作：用下面的步骤按钮或统一播放器完成教材流程。</p>'
      + '<small>记录限本页当前实验。刷新、重置、重新生成或重新打开收藏和分享后可重新填写。</small>';
    scene.querySelector('nav').before(prediction);

    const followup = document.createElement('section');
    followup.className = 'photo-learning';
    followup.innerHTML = '<h4>3. 比较</h4>'
      + (senior ? '<fieldset data-observation>'
        + select('source','记录来源',[['class','课堂观察（学生提供）'],['practice','假设练习（学生自填）']])
        + '<label>统一观察时长（分钟）<input type="text" inputmode="decimal" maxlength="8" data-learning="minutes"></label>'
        + '<label class="photo-learning-check"><input type="checkbox" data-learning="comparable">三组观察时段一致，材料、供碳、温度等其他条件可比</label></fieldset>' : '')
      + '<p data-comparison role="status"></p><h4>4. 解释</h4><fieldset data-explanation>'
      + (senior
        ? select('reason','怎样解读浮起数量？',[['correct','只比较同一时段的上浮指标'],['rate','直接换算实际产氧速率'],['zero','零片上浮说明光合作用为零']])
        : select('variable','同叶对照改变了什么？',[['correct','是否见光'],['leaf','叶片品种']])
          + select('reason','碘液在这里有什么作用？',[['correct','检验淀粉'],['color','除去叶绿素']]))
      + '</fieldset><p data-explanation-result role="status"></p>';
    const record = scene.querySelector('.leaf-disks-record');
    if (senior) {
      record.after(followup);
      Array.from(record.querySelectorAll('[data-observed-count]')).forEach((cell, i) => {
        cell.innerHTML = '<span>待观察</span>'+input('observed'+i, groups[i]+'记录浮起数');
      });
      record.querySelector('p').textContent = '填写各组浮起数（0–10）。网页动画只演示单片上浮机理。';
    } else scene.querySelector('.photo-caution').before(followup);

    const fields = Object.fromEntries([...scene.querySelectorAll('[data-learning]')].map(el => [el.dataset.learning,el]));
    const draft = {scene, senior, fields, started:false, ready:false};
    scene.addEventListener('input', event => {
      if (event.target.matches('[data-learning]')) paint(draft);
    });
    drafts.set(scene, draft);
    paint(draft);
    return draft;
  }

  function highComparison(fields) {
    const raw = groups.map((_, i) => fields['observed'+i].value.trim());
    const observed = raw.map(countValue);
    const invalid = observed.findIndex((value, i) => value === null && raw[i]);
    if (invalid >= 0) return groups[invalid]+'浮起数须为 0–10 的整数。';
    if (observed.includes(null)) return '请录齐三组浮起数后比较。';
    if (!fields.source.value) return '请选择课堂观察或假设练习，标明数据来源。';
    const time = fields.minutes.value.trim();
    if (!validMinutes(time)) return '请填写大于 0 且不超过 1440 的统一观察分钟数，最多两位小数。';
    if (!fields.comparable.checked) return '请先确认三组时段与其他条件可比，再比较。';
    const rows = observed.map((value, i) => {
      const predicted = countValue(fields['predict'+i].value.trim());
      const difference = predicted === null ? '未记录有效预测' : '预测 '+predicted+'，记录减预测为 '+(value-predicted)+' 片';
      return groups[i]+' '+value+' 片（'+difference+'）';
    });
    const leaders = groups.filter((_, i) => observed[i] === Math.max(...observed));
    const compare = leaders.length === 3 ? '三组记录相同。'
      : leaders.join('、')+(leaders.length === 1 ? '记录最高。' : '记录并列最高。');
    const source = fields.source.value === 'class' ? '课堂观察（学生提供，网页未经实测核验）' : '假设练习（学生填写）';
    return source+'，统一观察 '+time+' 分钟。'+rows.join('。')+'。'+compare;
  }

  function paint({scene, senior, fields, started, ready}) {
    scene.querySelector('[data-predictions]').disabled = started;
    scene.querySelector('[data-explanation]').disabled = !ready;
    if (senior) {
      scene.querySelector('[data-observation]').disabled = !ready;
      groups.forEach((_, i) => {
        const el = fields['observed'+i];
        el.disabled = !ready;
        el.previousElementSibling.hidden = Boolean(el.value);
      });
    }
    const label = el => ({blue:'变蓝',plain:'不变蓝'})[el.value] || '未预测';
    scene.querySelector('[data-comparison]').textContent = !ready ? '先完成观察步骤，再比较预测与观察。'
      : senior ? highComparison(fields)
      : '我的预测：原见光区'+label(fields.predict0)+'，原遮光区'+label(fields.predict1)
        +'。教材预期：原见光区变蓝，原遮光区不变蓝。此处为教材演示现象。';
    let explanation = '';
    if (ready && fields.reason.value) {
      if (senior) explanation = fields.reason.value === 'correct'
        ? '判断正确。浮起数量是间接指标，宜在同条件同一时段比较。'
        : '再想一想：浮起数量不能直接换算产氧量或速率，零片上浮也不能证明没有光合作用。';
      else if (!fields.variable.value) explanation = '请选择同叶对照变量。';
      else explanation = fields.variable.value === 'correct' && fields.reason.value === 'correct'
        ? '判断正确。同一叶片比较是否见光，滴碘用来检验淀粉。'
        : '再看同叶对照：黑纸改变是否见光，酒精用于脱色，碘液用于检验淀粉。';
    }
    scene.querySelector('[data-explanation-result]').textContent = explanation;
  }

  function render(root, id, progress, frame) {
    const senior = id === 'leafDisks';
    const scene = root.querySelector(senior ? '.biology-leaf-disks-scene' : '.biology-photosynthesis-scene');
    if (!scene) return;
    const draft = drafts.get(scene) || mount(scene, senior);
    const started = draft.started || progress > 0;
    const ready = senior ? frame.observationStage : frame.observationReady;
    if (started === draft.started && ready === draft.ready) return;
    Object.assign(draft,{started,ready});
    paint(draft);
  }

  function clear(root) {
    const scene = root?.querySelector('.biology-leaf-disks-scene,.biology-photosynthesis-scene');
    const draft = drafts.get(scene);
    if (!draft) return;
    for (const field of Object.values(draft.fields)) {
      if (field.type === 'checkbox') field.checked = false;
      else field.value = '';
    }
    draft.started = draft.ready = false;
    paint(draft);
  }

  window.MasterLabPhotosynthesisLearning = Object.freeze({render,clear});
})();
