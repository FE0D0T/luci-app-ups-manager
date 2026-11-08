'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require poll';

var callGetBeeper = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_beeper',
	expect: { '': {} }
});

var callSetBeeperOnce = rpc.declare({
	object: 'luci.ups-manager',
	method: 'set_beeper_once',
	params: ['state'],
	expect: { '': {} }
});

var callSetBeeperMode = rpc.declare({
	object: 'luci.ups-manager',
	method: 'set_beeper_mode',
	params: ['mode', 'schedule_on', 'schedule_off'],
	expect: { '': {} }
});

var MODES = [
	{ id: 'off', label: 'Обычный' },
	{ id: 'once_off', label: 'Выключить до перезагрузки' },
	{ id: 'permanent_off', label: 'Выключать постоянно' },
	{ id: 'schedule', label: 'Расписание' }
];

function stateView(st) {
	var mode = st.mode || 'off';
	if (st.state === 'unknown') {
		return { text: 'Нет связи с ИБП', color: '#dc2626' };
	}
	if (mode === 'schedule') {
		var now = (st.now_state === 'disabled') ? 'сейчас выключен' : 'сейчас включён';
		return { text: 'Расписание (' + now + ')', color: '#7c3aed' };
	}
	if (mode === 'permanent_off') {
		return { text: 'Выключен постоянно', color: '#dc2626' };
	}
	if (st.state === 'enabled') {
		return { text: 'Звук включён', color: '#16a34a' };
	}
	return { text: 'Звук выключен', color: '#f97316' };
}

function scheduleText(st) {
	return 'Сохранённые значения: выключать в ' + (st.schedule_off || '—') +
		', включать в ' + (st.schedule_on || '—') + '.';
}

return view.extend({
	dirty: false,

	load: function() {
		return callGetBeeper();
	},

	render: function(data) {
		var self = this;
		var st = data || {};

		self.stateEl = E('div', { 'style': 'font-size:1.6rem;font-weight:700;margin:0.4rem 0;' }, '');
		self.hintEl = E('div', { 'style': 'font-size:0.8rem;color:var(--text-color-medium, #64748b);' }, '');
		self.offInput = E('input', {
			'class': 'cbi-input-text', 'type': 'time',
			'input': function() { self.dirty = true; }
		});
		self.onInput = E('input', {
			'class': 'cbi-input-text', 'type': 'time',
			'input': function() { self.dirty = true; }
		});
		self.scheduleBox = E('div', { 'style': 'display:none;gap:0.75rem;max-width:420px;margin-top:1rem;' }, [
			E('label', {}, ['Выключать в: ', self.offInput]),
			E('label', {}, ['Включать в: ', self.onInput]),
			self.hintEl,
			E('div', { 'style': 'display:flex;gap:0.6rem;' }, [
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': function() { return self.saveSchedule(); }
				}, 'Сохранить расписание')
			])
		]);

		self.modeButtons = {};
		var buttons = MODES.map(function(m) {
			var b = E('button', {
				'class': 'cbi-button cbi-button-neutral beeper-mode-btn',
				'click': function() { return self.pick(m.id); }
			}, m.label);
			self.modeButtons[m.id] = b;
			return b;
		});

		self.applyState(st);

		// Автообновление статуса каждые 5 секунд
		poll.add(function() {
			return self.refresh();
		}, 5);

		return E('div', { 'class': 'cbi-map' }, [
			E('style', {}, ['@media (max-width: 600px) { .beeper-mode-btn { flex: 1 1 100%; text-align: center; } }']),
			E('h2', { 'class': 'cbi-map-title' }, 'Звук ИБП'),
			E('div', { 'class': 'cbi-map-descr' }, 'Управление звуковым сигналом ИБП. Статус обновляется автоматически.'),
			E('div', { 'class': 'cbi-section', 'style': 'padding:1.25rem;' }, [
				E('div', { 'style': 'font-size:0.85rem;color:var(--text-color-medium, #64748b);' }, 'Текущее состояние звука ИБП'),
				self.stateEl
			]),
			E('div', { 'class': 'cbi-section', 'style': 'padding:1.25rem;' }, [
				E('h3', { 'class': 'cbi-section-title' }, 'Режимы звука'),
				E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:0.6rem;' }, buttons),
				self.scheduleBox
			])
		]);
	},

	// Обновить статус, подсветку режима и значения расписания (без перезагрузки страницы)
	applyState: function(st) {
		var sv = stateView(st);
		var mode = st.mode || 'off';

		this.stateEl.textContent = sv.text;
		this.stateEl.style.color = sv.color;

		Object.keys(this.modeButtons).forEach(function(id) {
			var b = this.modeButtons[id];
			var active = (id === mode);
			b.className = 'cbi-button beeper-mode-btn ' + (active ? 'cbi-button-apply' : 'cbi-button-neutral');
		}, this);

		this.scheduleBox.style.display = (mode === 'schedule') ? 'grid' : 'none';
		this.hintEl.textContent = scheduleText(st);

		// Поля времени заполняем, только если пользователь их не редактирует
		if (!this.dirty) {
			this.offInput.value = st.schedule_off || '23:00';
			this.onInput.value = st.schedule_on || '07:00';
		}
	},

	refresh: function() {
		var self = this;
		return callGetBeeper().then(function(st) {
			self.applyState(st || {});
		}).catch(function() {});
	},

	// Выбор режима. Обычный режим включает звук и ставит режим off.
	pick: function(id) {
		var self = this;
		var p;

		if (id === 'once_off') {
			p = callSetBeeperOnce('off').then(function(res) {
				self.notify(res, 'Звук выключен до перезагрузки.');
			});
		} else if (id === 'off') {
			p = callSetBeeperOnce('on').then(function(res) {
				if (!res || !res.success) { self.notify(res, ''); return; }
				return callSetBeeperMode('off', '', '').then(function(r2) {
					self.notify(r2, 'Обычный режим: звук включён.');
				});
			});
		} else if (id === 'permanent_off') {
			p = callSetBeeperMode('permanent_off', '', '').then(function(res) {
				self.notify(res, 'Звук выключается постоянно.');
			});
		} else if (id === 'schedule') {
			// Переход на расписание: сохраняем значения из полей, если они заполнены
			var on = this.onInput ? this.onInput.value : '';
			var off = this.offInput ? this.offInput.value : '';
			p = callSetBeeperMode('schedule', on, off).then(function(res) {
				self.dirty = false;
				self.notify(res, 'Режим расписания включён.');
			});
		}

		return Promise.resolve(p).then(function() { return self.refresh(); });
	},

	// Сохранить время расписания из полей
	saveSchedule: function() {
		var self = this;
		var on = this.onInput.value;
		var off = this.offInput.value;
		return callSetBeeperMode('schedule', on, off).then(function(res) {
			self.dirty = false;
			self.notify(res, 'Расписание сохранено: выключать в ' + off + ', включать в ' + on + '.');
			return self.refresh();
		});
	},

	notify: function(res, okText) {
		if (res && res.success) {
			if (okText) ui.addNotification(null, E('p', {}, okText), 'info');
		} else {
			ui.addNotification(null, E('p', {}, 'Ошибка: ' + ((res && res.error) || 'неизвестно')), 'danger');
		}
	}
});
