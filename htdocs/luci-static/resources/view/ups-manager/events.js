'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callGetOpsEvents = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_ops_events',
	expect: { '': {} }
});

var callClearOpsEvents = rpc.declare({
	object: 'luci.ups-manager',
	method: 'clear_ops_events',
	expect: { '': {} }
});

return view.extend({
	filterType: 'all',
	events: [],

	load: function() {
		return callGetOpsEvents().catch(function() {
			return { total: 0, events: [] };
		});
	},

	render: function(data) {
		var self = this;
		this.events = (data && data.events) ? data.events : [];

		var container = E('div', { 'class': 'cbi-map ups-events-view' });

		var styleNode = E('style', {}, [
			'.ups-events-view { max-width: 1280px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Helvetica Neue", Arial, sans-serif; color: #1e293b; }',
			'.dark-mode .ups-events-view { color: var(--text-color-highest, #f8fafc); }',
			'.event-panel-card { background: var(--background-color-low, #ffffff); border: 1px solid var(--cbi-section-border, #e2e8f0); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }',
			'.dark-mode .event-panel-card { background: #1e293b; border-color: var(--text-color-high, #334155); }',
			'.event-top-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }',
			'.event-title-wrap { display: flex; align-items: center; gap: 0.6rem; }',
			'.event-main-title { font-size: 1.25rem; font-weight: 800; color: var(--text-color-high, #0f172a); margin: 0; display: flex; align-items: center; gap: 0.45rem; }',
			'.dark-mode .event-main-title { color: var(--text-color-highest, #f8fafc); }',
			'.event-count-badge { font-size: 0.85rem; color: var(--text-color-medium, #64748b); font-weight: 500; }',
			'.dark-mode .event-count-badge { color: var(--text-color-medium, #94a3b8); }',
			'.event-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }',
			'.event-filter-select { border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.35rem 0.65rem; font-size: 0.82rem; background: var(--background-color-low, #ffffff); color: var(--text-color-high, #0f172a); }',
			'.dark-mode .event-filter-select { background: var(--background-color-high, #0f172a); color: var(--text-color-highest, #ffffff); border-color: var(--text-color-medium, #475569); }',
			'.event-btn-light { border: 1px solid var(--border-color-high, #e2e8f0); background: var(--background-color-low, #ffffff); color: var(--text-color-high, #334155); border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 500; transition: all 0.2s; }',
			'.event-btn-light:hover { background: var(--background-color-low, #f8fafc); border-color: #cbd5e1; }',
			'.dark-mode .event-btn-light { background: #1e293b; border-color: var(--text-color-high, #334155); color: var(--text-color-highest, #f8fafc); }',
			'.dark-mode .event-btn-light:hover { background: #334155; }',
			'.event-notice-box { background: rgba(59,130,246,0.18); border: 1px solid #bfdbfe; border-radius: 10px; padding: 1rem 1.25rem; margin: 1.15rem 0 1.25rem 0; font-size: 0.82rem; color: #1e293b; }',
			'.dark-mode .event-notice-box { background: #1e3a8a25; border-color: #1e40af; color: #e2e8f0; }',
			'.event-notice-title { font-weight: 700; color: #1d4ed8; font-size: 0.9rem; margin-bottom: 0.45rem; display: flex; align-items: center; gap: 0.4rem; }',
			'.dark-mode .event-notice-title { color: #60a5fa; }',
			'.event-notice-p { margin: 0.3rem 0; line-height: 1.6; color: var(--text-color-high, #334155); }',
			'.dark-mode .event-notice-p { color: var(--text-color-medium, #94a3b8); }',
			'.event-row-card { background: var(--background-color-low, #ffffff); border: 1px solid #f1f5f9; border-radius: 8px; padding: 0.9rem 1.25rem; margin-bottom: 0.75rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: transform 0.15s, box-shadow 0.15s; }',
			'.dark-mode .event-row-card { background: #1e293b; border-color: var(--text-color-high, #334155); }',
			'.event-row-card:hover { transform: translateY(-1px); box-shadow: 0 3px 6px rgba(0,0,0,0.04); }',
			'.event-row-card.border-red { border-left: 4px solid #ef4444; }',
			'.event-row-card.border-green { border-left: 4px solid #10b981; }',
			'.event-row-card.border-blue { border-left: 4px solid #3b82f6; }',
			'.event-row-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.4rem; }',
			'.event-row-header-left { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }',
			'.event-tag-pill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }',
			'.event-tag-red { background: rgba(239,68,68,0.22); color: #dc2626; }',
			'.event-tag-green { background: rgba(16,185,129,0.22); color: #059669; }',
			'.event-tag-blue { background: var(--background-color-low, #f1f5f9); color: var(--text-color-high, #475569); }',
			'.dark-mode .event-tag-blue { background: #334155; color: var(--text-color-medium, #94a3b8); }',
			'.event-row-title { font-size: 0.92rem; font-weight: 700; color: var(--text-color-high, #0f172a); }',
			'.dark-mode .event-row-title { color: var(--text-color-highest, #f8fafc); }',
			'.event-row-time { font-family: monospace; font-size: 0.78rem; color: var(--text-color-medium, #94a3b8); }',
			'.event-row-desc { font-size: 0.83rem; color: var(--text-color-medium, #64748b); margin: 0; line-height: 1.55; }',
			'.dark-mode .event-row-desc { color: var(--text-color-medium, #94a3b8); }'
		]);

		container.appendChild(styleNode);

		var panelCard = E('div', { 'class': 'event-panel-card' });

		// Top Action Bar
		var titleNode = E('div', { 'class': 'event-title-wrap' }, [
			E('h2', { 'class': 'event-main-title' }, ['⏱️ ', _('История событий ИБП и журнал обслуживания')]),
			E('span', { 'class': 'event-count-badge', 'id': 'events-count-label' }, (this.events.length) + _(' записей'))
		]);

		var filterSelect = E('select', {
			'class': 'event-filter-select',
			'change': function(ev) {
				self.filterType = ev.target.value;
				self.updateEventList();
			}
		}, [
			E('option', { 'value': 'all' }, _('🔍 Все типы событий')),
			E('option', { 'value': 'power' }, _('⚡ События питания')),
			E('option', { 'value': 'comm' }, _('🔌 Порт/протокол')),
			E('option', { 'value': 'ops' }, _('⚙️ Обслуживание системы'))
		]);

		var refreshBtn = E('button', {
			'class': 'event-btn-light',
			'click': function() {
				return self.refresh();
			}
		}, ['🔄 ', _('Обновить')]);

		var clearBtn = E('button', {
			'class': 'event-btn-light',
			'click': function() {
				if (!confirm(_('Очистить все события и историю обслуживания ИБП?'))) return;
				callClearOpsEvents().then(function() {
					self.events = [];
					self.updateEventList();
					ui.addNotification(null, E('p', {}, _('Журнал успешно очищен.')), 'info');
				});
			}
		}, ['🗑️ ', _('Очистить журнал')]);

		var toggleNoticeBtn = E('button', {
			'class': 'event-btn-light',
			'title': _('Развернуть/свернуть общие сведения об эксплуатации ИБП'),
			'click': function() {
				var box = document.getElementById('event-universal-notice');
				if (box) {
					var isHidden = box.style.display === 'none';
					box.style.display = isHidden ? 'block' : 'none';
					try {
						localStorage.setItem('ups_manager_notice_visible', isHidden ? '1' : '0');
					} catch (e) {}
				}
			}
		}, ['💡 ', _('Сведения об эксплуатации')]);

		var actionsNode = E('div', { 'class': 'event-actions' }, [
			filterSelect,
			toggleNoticeBtn,
			refreshBtn,
			clearBtn
		]);

		var topBar = E('div', { 'class': 'event-top-bar' }, [
			titleNode,
			actionsNode
		]);

		panelCard.appendChild(topBar);

		// Universal Operational Guidance Box (For all UPS topologies: Standby, Line-Interactive, Online)
		var isNoticeVisible = true;
		try {
			if (localStorage.getItem('ups_manager_notice_visible') === '0') {
				isNoticeVisible = false;
			}
		} catch (e) {}

		var closeNoticeBtn = E('button', {
			'style': 'background:transparent;border:none;color:var(--text-color-medium, #94a3b8);font-size:0.85rem;cursor:pointer;padding:0 4px;',
			'title': _('Закрыть пояснение'),
			'click': function() {
				var box = document.getElementById('event-universal-notice');
				if (box) box.style.display = 'none';
				try {
					localStorage.setItem('ups_manager_notice_visible', '0');
				} catch (e) {}
			}
		}, '✕');

		var noticeBox = E('div', {
			'class': 'event-notice-box',
			'id': 'event-universal-notice',
			'style': isNoticeVisible ? '' : 'display:none;'
		}, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:0.45rem;' }, [
				E('div', { 'class': 'event-notice-title', 'style': 'margin-bottom:0;' }, [
					'ℹ️ 💡 ',
					_('Общие сведения о питании и состоянии ИБП')
				]),
				closeNoticeBtn
			]),
			E('p', { 'class': 'event-notice-p' }, _('1. Потребление при зарядке после восстановления сети: после разряда ИБП при восстановлении сети внутренний зарядник включает ток заряда большой силы (входная мощность временно растёт, дополнительно 15–50 Вт на зарядку). Когда батарея заряжена и переходит в режим постоянного напряжения, потребление возвращается к базовому уровню ожидания.')),
			E('p', { 'class': 'event-notice-p' }, _('2. Разница в потреблении в режиме ожидания по архитектуре: ИБП резервного и линейно-интерактивного типа (например, настольные бытовые модели) в норме работают в байпасе, и потребление без нагрузки очень низкое (обычно 3–8 Вт). Чисто онлайновые ИБП с двойным преобразованием постоянно работают через выпрямитель и инвертор, поэтому в режиме ожидания потребляют около 25–50 Вт (в моделях с режимом ECO можно снизить расход, включив байпас).')),
			E('p', { 'class': 'event-notice-p' }, _('3. Диагностика офлайн-устройства и сбоев связи: при предупреждении о потере связи сначала проверьте надёжность USB/последовательного кабеля, готовность драйвера USB HID или последовательного порта в ядре и состояние фонового демона NUT.'))
		]);

		panelCard.appendChild(noticeBox);

		// Events List Container
		var listContainer = E('div', { 'id': 'events-timeline-container' }, this.renderEventItems());
		panelCard.appendChild(listContainer);

		container.appendChild(panelCard);
		return container;
	},

	renderEventItems: function() {
		var self = this;
		var filtered = this.events.filter(function(ev) {
			if (self.filterType === 'all') return true;
			return ev.category === self.filterType;
		});

		if (filtered.length === 0) {
			return [
				E('div', { 'style': 'text-align:center;padding:3rem 1rem;color:var(--text-color-medium, #94a3b8);' }, [
					E('div', { 'style': 'font-size:1.8rem;margin-bottom:0.6rem;' }, '🟢'),
					E('div', { 'style': 'font-size:0.95rem;font-weight:700;color:var(--text-color-medium, #64748b);margin-bottom:0.35rem;' }, _('Реальных записей о событиях пока нет')),
					E('div', { 'style': 'font-size:0.8rem;color:var(--text-color-medium, #94a3b8);max-width:480px;margin:0 auto;line-height:1.6;' },
						_('Система работает в штатном режиме мониторинга, имитационные данные полностью удалены. При отключении и восстановлении сети, обрыве и восстановлении связи USB, низком заряде батареи или изменении настроек реальные события сразу появятся здесь.'))
				])
			];
		}

		var items = [];
		filtered.forEach(function(ev) {
			var cardClass = 'event-row-card';
			var tagNode = null;

			if (ev.category === 'comm') {
				cardClass += ' border-red';
				tagNode = E('span', { 'class': 'event-tag-pill event-tag-red' }, ['🔴 ⚡ ', _('Порт/протокол')]);
			} else if (ev.category === 'power') {
				if (ev.level === 'warn') {
					cardClass += ' border-red';
					tagNode = E('span', { 'class': 'event-tag-pill event-tag-red' }, ['🔴 ⚡ ', _('События питания')]);
				} else {
					cardClass += ' border-green';
					tagNode = E('span', { 'class': 'event-tag-pill event-tag-green' }, ['🟢 ⚡ ', _('События питания')]);
				}
			} else {
				cardClass += ' border-blue';
				tagNode = E('span', { 'class': 'event-tag-pill event-tag-blue' }, ['ℹ️ ', _('Обслуживание системы')]);
			}

			var itemNode = E('div', { 'class': cardClass }, [
				E('div', { 'class': 'event-row-header' }, [
					E('div', { 'class': 'event-row-header-left' }, [
						tagNode,
						E('span', { 'class': 'event-row-title' }, ev.title)
					]),
					E('span', { 'class': 'event-row-time' }, ev.time || '')
				]),
				E('p', { 'class': 'event-row-desc' }, ev.desc)
			]);

			items.push(itemNode);
		});

		return items;
	},

	updateEventList: function() {
		var container = document.getElementById('events-timeline-container');
		if (container) {
			dom.content(container, this.renderEventItems());
		}
		var label = document.getElementById('events-count-label');
		if (label) {
			label.innerText = this.events.length + _(' записей');
		}
	},

	refresh: function() {
		var self = this;
		return callGetOpsEvents().then(function(res) {
			self.events = (res && res.events) ? res.events : [];
			self.updateEventList();
			ui.addNotification(null, E('p', {}, _('Журнал событий и обслуживания обновлён')), 'info');
		});
	}
});
