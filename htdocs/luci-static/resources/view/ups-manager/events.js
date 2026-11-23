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

var callGetQualityEvents = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_quality_events',
	expect: { '': {} }
});

var callClearQualityEvents = rpc.declare({
	object: 'luci.ups-manager',
	method: 'clear_quality_events',
	expect: { '': {} }
});

var PAGE_SIZE = 20;

return view.extend({
	filterType: 'all',
	pageIdx: 0,
	events: [],

	load: function() {
		return Promise.all([
			callGetOpsEvents().catch(function() { return { events: [] }; }),
			callGetQualityEvents().catch(function() { return { events: [] }; })
		]);
	},

	mergeEvents: function(data) {
		var merged = [];
		var ops = (data[0] && data[0].events) ? data[0].events : [];
		var qual = (data[1] && data[1].events) ? data[1].events : [];

		ops.forEach(function(ev) {
			merged.push({
				id: ev.id,
				time: ev.time || '',
				category: ev.category || 'ops',
				level: ev.level || 'info',
				title: ev.title || '',
				desc: ev.desc || '',
				value: '',
				status: ''
			});
		});

		qual.forEach(function(ev) {
			merged.push({
				id: ev.id,
				time: ev.time || '',
				category: 'quality',
				level: ev.severity || 'warning',
				title: ev.title || _('Колебания показателей электроэнергии'),
				desc: ev.detail || _('Показатели сети вышли за безопасные пределы. Событие записано в журнал анализа качества электроэнергии.'),
				value: ev.value || '',
				status: ev.status || '',
				duration: ev.duration || ''
			});
		});

		// Единый формат времени ГГГГ/ММ/ДД ЧЧ:ММ:СС → лексикографическая сортировка
		merged.sort(function(a, b) {
			if (a.time === b.time) return 0;
			return a.time > b.time ? -1 : 1;
		});

		return merged;
	},

	render: function(data) {
		var self = this;
		this.events = this.mergeEvents(data);
		this.pageIdx = 0;

		var container = E('div', { 'class': 'cbi-map ups-events-view' });

		var styleNode = E('style', {}, [
			'.ups-events-view { max-width: 1280px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Helvetica Neue", Arial, sans-serif; color: var(--proton-fg, #1e293b); }',
			'.dark-mode .ups-events-view { color: var(--text-color-highest, #f8fafc); }',
			'.event-panel-card { background: var(--proton-card-solid, var(--background-color-low, #ffffff)); border: 1px solid var(--proton-border, var(--cbi-section-border, #e2e8f0)); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; box-shadow: var(--proton-shadow-sm, 0 1px 3px rgba(0,0,0,0.02)); }',
			'.dark-mode .event-panel-card { background: var(--proton-card-solid, #1e293b); border-color: var(--proton-border, var(--text-color-high, #334155)); }',
			'.event-top-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }',
			'.event-title-wrap { display: flex; align-items: center; gap: 0.6rem; }',
			'.event-main-title { font-size: 1.25rem; font-weight: 800; color: var(--text-color-high, #0f172a); margin: 0; display: flex; align-items: center; gap: 0.45rem; }',
			'.dark-mode .event-main-title { color: var(--text-color-highest, #f8fafc); }',
			'.event-count-badge { font-size: 0.85rem; color: var(--text-color-medium, #64748b); font-weight: 500; }',
			'.dark-mode .event-count-badge { color: var(--text-color-medium, #94a3b8); }',
			'.event-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }',
			'.event-filter-select { border: 1px solid var(--proton-border, #cbd5e1); border-radius: 6px; padding: 0.35rem 0.65rem; font-size: 0.82rem; background: var(--proton-card-solid, var(--background-color-low, #ffffff)); color: var(--text-color-high, #0f172a); }',
			'.dark-mode .event-filter-select { background: var(--proton-card-solid, var(--background-color-high, #0f172a)); color: var(--proton-fg, #ffffff); border-color: var(--proton-border, var(--text-color-medium, #475569)); }',
			'.event-btn-light { border: 1px solid var(--proton-border, var(--border-color-high, #e2e8f0)); background: var(--proton-card-solid, var(--background-color-low, #ffffff)); color: var(--text-color-high, #334155); border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 500; transition: all 0.2s; }',
			'.event-btn-light:hover { background: var(--proton-bg-hover, var(--background-color-low, #f8fafc)); border-color: var(--proton-border, #cbd5e1); }',
			'.dark-mode .event-btn-light { background: var(--proton-card-solid, #1e293b); border-color: var(--proton-border, var(--text-color-high, #334155)); color: var(--text-color-highest, #f8fafc); }',
			'.dark-mode .event-btn-light:hover { background: var(--proton-bg-hover, #334155); }',
			'.event-notice-box { background: var(--proton-accent-glow, rgba(59,130,246,0.18)); border: 1px solid var(--proton-border, #bfdbfe); border-radius: 10px; padding: 1rem 1.25rem; margin: 1.15rem 0 1.25rem 0; font-size: 0.82rem; color: var(--proton-fg, #1e293b); }',
			'.dark-mode .event-notice-box { background: var(--proton-accent-glow, #1e3a8a25); border-color: var(--proton-border, #1e40af); color: var(--proton-fg, #e2e8f0); }',
			'.event-notice-title { font-weight: 700; color: var(--proton-accent, #1d4ed8); font-size: 0.9rem; margin-bottom: 0.45rem; display: flex; align-items: center; gap: 0.4rem; }',
			'.dark-mode .event-notice-title { color: var(--proton-accent, #60a5fa); }',
			'.event-notice-p { margin: 0.3rem 0; line-height: 1.6; color: var(--text-color-high, #334155); }',
			'.dark-mode .event-notice-p { color: var(--text-color-medium, #94a3b8); }',
			'.event-row-card { background: var(--proton-card-solid, var(--background-color-low, #ffffff)); border: 1px solid var(--proton-border-light, #f1f5f9); border-radius: 8px; padding: 0.9rem 1.25rem; margin-bottom: 0.75rem; box-shadow: var(--proton-shadow-sm, 0 1px 2px rgba(0,0,0,0.02)); transition: transform 0.15s, box-shadow 0.15s; }',
			'.dark-mode .event-row-card { background: var(--proton-card-solid, #1e293b); border-color: var(--proton-border, var(--text-color-high, #334155)); }',
			'.event-row-card:hover { transform: translateY(-1px); box-shadow: var(--proton-shadow-sm, 0 3px 6px rgba(0,0,0,0.04)); }',
			'.event-row-card.border-red { border-left: 4px solid var(--proton-danger, #ef4444); }',
			'.event-row-card.border-green { border-left: 4px solid var(--proton-success, #10b981); }',
			'.event-row-card.border-blue { border-left: 4px solid var(--proton-accent, #3b82f6); }',
			'.event-row-card.border-purple { border-left: 4px solid var(--ups-series-power, #8b5cf6); }',
			'.event-row-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.4rem; }',
			'.event-row-header-left { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }',
			'.event-tag-pill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }',
			'.event-tag-red { background: rgba(239,68,68,0.22); color: var(--proton-danger, #dc2626); }',
			'.event-tag-green { background: rgba(16,185,129,0.22); color: var(--proton-success, #059669); }',
			'.event-tag-purple { background: rgba(139,92,246,0.22); color: var(--ups-series-power, #7c3aed); }',
			'.event-tag-blue { background: var(--proton-bg-secondary, var(--background-color-low, #f1f5f9)); color: var(--text-color-high, #475569); }',
			'.dark-mode .event-tag-blue { background: var(--proton-bg-hover, #334155); color: var(--text-color-medium, #94a3b8); }',
			'.event-tag-gray { background: var(--proton-bg-secondary, var(--background-color-low, #f1f5f9)); color: var(--text-color-medium, #64748b); }',
			'.dark-mode .event-tag-gray { background: var(--proton-bg-hover, #334155); color: var(--text-color-medium, #94a3b8); }',
			'.event-row-title { font-size: 0.92rem; font-weight: 700; color: var(--text-color-high, #0f172a); }',
			'.dark-mode .event-row-title { color: var(--text-color-highest, #f8fafc); }',
			'.event-row-time { font-family: monospace; font-size: 0.78rem; color: var(--text-color-medium, #94a3b8); }',
			'.event-row-desc { font-size: 0.83rem; color: var(--text-color-medium, #64748b); margin: 0; line-height: 1.55; }',
			'.dark-mode .event-row-desc { color: var(--text-color-medium, #94a3b8); }',
			'.event-pager { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: var(--text-color-medium, #64748b); margin-top: 1.25rem; border-top: 1px solid var(--proton-border-light, #f1f5f9); padding-top: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }',
			'.dark-mode .event-pager { border-top-color: var(--proton-border, var(--text-color-high, #334155)); }',
			'.event-pager .event-btn-light[disabled] { opacity: 0.45; cursor: default; }'
		]);

		container.appendChild(styleNode);

		var panelCard = E('div', { 'class': 'event-panel-card' });

		// Top Action Bar
		var titleNode = E('div', { 'class': 'event-title-wrap' }, [
			E('h2', { 'class': 'event-main-title' }, ['⏱️ ', _('Журнал событий ИБП')]),
			E('span', { 'class': 'event-count-badge', 'id': 'events-top-count' }, this.events.length + _(' записей'))
		]);

		var filterSelect = E('select', {
			'class': 'event-filter-select',
			'change': function(ev) {
				self.filterType = ev.target.value;
				self.pageIdx = 0;
				self.updateEventList();
			}
		}, [
			E('option', { 'value': 'all' }, _('🔍 Все события')),
			E('option', { 'value': 'power' }, _('⚡ События питания')),
			E('option', { 'value': 'quality' }, _('〰️ Отклонения качества сети')),
			E('option', { 'value': 'comm' }, _('🔌 Связь / порт')),
			E('option', { 'value': 'ops' }, _('⚙️ Обслуживание'))
		]);

		var refreshBtn = E('button', {
			'class': 'event-btn-light',
			'click': function() {
				return self.refresh();
			}
		}, ['🔄 ', _('Обновить')]);

		var exportBtn = E('button', {
			'class': 'event-btn-light',
			'click': function() {
				self.exportCSV();
			}
		}, ['📄 ', _('Экспорт CSV')]);

		var clearBtn = E('button', {
			'class': 'event-btn-light',
			'click': function() {
				if (!confirm(_('Очистить весь журнал: события обслуживания и отклонения качества сети?'))) return;
				Promise.all([
					callClearOpsEvents().catch(function() { return {}; }),
					callClearQualityEvents().catch(function() { return {}; })
				]).then(function() {
					self.events = [];
					self.pageIdx = 0;
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
			exportBtn,
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

		// Pagination footer
		var pager = E('div', { 'class': 'event-pager', 'id': 'events-pager' }, this.renderPagerNodes());
		panelCard.appendChild(pager);

		container.appendChild(panelCard);
		return container;
	},

	getFiltered: function() {
		var self = this;
		return this.events.filter(function(ev) {
			if (self.filterType === 'all') return true;
			return ev.category === self.filterType;
		});
	},

	renderPagerNodes: function() {
		var self = this;
		var filtered = this.getFiltered();
		var pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
		if (this.pageIdx >= pages) this.pageIdx = pages - 1;

		var prevBtn = E('button', {
			'class': 'event-btn-light',
			'disabled': this.pageIdx <= 0,
			'click': function() {
				if (self.pageIdx > 0) {
					self.pageIdx--;
					self.updateEventList();
				}
			}
		}, ['← ', _('Назад')]);

		var nextBtn = E('button', {
			'class': 'event-btn-light',
			'disabled': this.pageIdx >= pages - 1,
			'click': function() {
				if (self.pageIdx < pages - 1) {
					self.pageIdx++;
					self.updateEventList();
				}
			}
		}, [_('Вперёд'), ' →']);

		return [
			E('span', { 'id': 'events-count-label' }, filtered.length + _(' записей · стр. ') + (this.pageIdx + 1) + '/' + pages),
			E('div', { 'style': 'display:flex;align-items:center;gap:0.5rem;' }, [
				E('span', {}, _('по ' + PAGE_SIZE + ' на странице')),
				prevBtn,
				nextBtn
			])
		];
	},

	renderEventItems: function() {
		var self = this;
		var filtered = this.getFiltered();

		if (filtered.length === 0) {
			return [
				E('div', { 'style': 'text-align:center;padding:3rem 1rem;color:var(--text-color-medium, #94a3b8);' }, [
					E('div', { 'style': 'font-size:1.8rem;margin-bottom:0.6rem;' }, '🟢'),
					E('div', { 'style': 'font-size:0.95rem;font-weight:700;color:var(--text-color-medium, #64748b);margin-bottom:0.35rem;' }, _('Реальных записей о событиях пока нет')),
					E('div', { 'style': 'font-size:0.8rem;color:var(--text-color-medium, #94a3b8);max-width:480px;margin:0 auto;line-height:1.6;' },
						_('Система работает в штатном режиме мониторинга. При отключении и восстановлении сети, обрыве и восстановлении связи USB, отклонениях качества сети, низком заряде батареи или изменении настроек реальные события сразу появятся здесь.'))
				])
			];
		}

		var start = this.pageIdx * PAGE_SIZE;
		var pageItems = filtered.slice(start, start + PAGE_SIZE);

		var items = [];
		pageItems.forEach(function(ev) {
			var cardClass = 'event-row-card';
			var tagNode = null;
			var extraNode = [];

			if (ev.category === 'comm') {
				cardClass += ' border-red';
				tagNode = E('span', { 'class': 'event-tag-pill event-tag-red' }, ['🔴 ', _('Связь / порт')]);
			} else if (ev.category === 'quality') {
				cardClass += (ev.level === 'critical' ? ' border-red' : ' border-purple');
				tagNode = E('span', { 'class': 'event-tag-pill event-tag-purple' }, ['〰️ ', _('Качество сети')]);
				if (ev.value) extraNode.push(E('span', { 'class': 'event-tag-pill event-tag-gray' }, ev.value));
				extraNode.push(E('span', {
					'class': 'event-tag-pill ' + (ev.status === 'recovered' ? 'event-tag-green' : 'event-tag-red'),
					'title': ev.status === 'recovered' ? _('Восстановлено (подробности)') : _('Активно (подробности)'),
					'click': function() { self.showEventModal(ev); },
					'style': 'cursor:pointer;'
				}, ev.status === 'recovered' ? ['🟢 ', _('Восстановлено')] : ['🔴 ', _('Активно')]));
			} else if (ev.category === 'power') {
				if (ev.level === 'warn' || ev.level === 'crit') {
					cardClass += ' border-red';
					tagNode = E('span', { 'class': 'event-tag-pill event-tag-red' }, ['🔴 ', _('События питания')]);
				} else {
					cardClass += ' border-green';
					tagNode = E('span', { 'class': 'event-tag-pill event-tag-green' }, ['🟢 ', _('События питания')]);
				}
			} else {
				cardClass += ' border-blue';
				tagNode = E('span', { 'class': 'event-tag-pill event-tag-blue' }, ['ℹ️ ', _('Обслуживание')]);
			}

			var itemNode = E('div', { 'class': cardClass }, [
				E('div', { 'class': 'event-row-header' }, [
					E('div', { 'class': 'event-row-header-left' }, [
						tagNode,
						E('span', { 'class': 'event-row-title' }, ev.title)
					].concat(extraNode)),
					E('span', { 'class': 'event-row-time' }, ev.time || '')
				]),
				E('p', { 'class': 'event-row-desc' }, ev.desc)
			]);

			items.push(itemNode);
		});

		return items;
	},

	showEventModal: function(ev) {
		ui.showModal(_('Подробности события отклонения качества электроэнергии'), [
			E('table', { 'class': 'table', 'style': 'margin-top:0.5rem;' }, [
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;width:35%;' }, _('Название события / ID')),
					E('td', {}, (ev.title || '') + ' (' + (ev.id || '') + ')')
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;' }, _('Уровень предупреждения')),
					E('td', {}, ev.level === 'critical' ? _('Критическое предупреждение') : _('Информационное предупреждение'))
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;' }, _('Текущее состояние')),
					E('td', {}, ev.status === 'recovered' ? _('🟢 Восстановлено') : _('🔴 Отклонение продолжается'))
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;' }, _('Значение при срабатывании')),
					E('td', { 'style': 'font-family:monospace;font-weight:bold;' }, ev.value || '--')
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;' }, _('Время срабатывания')),
					E('td', {}, ev.time || '--')
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;' }, _('Длительность отклонения')),
					E('td', {}, ev.duration || _('Кратковременное, устранено'))
				]),
				E('tr', {}, [
					E('td', { 'style': 'color:var(--text-color-high, #0f172a);font-weight:600;' }, _('Пояснение')),
					E('td', {}, ev.desc || _('Показатели сети вышли за безопасные пределы.'))
				])
			]),
			E('div', { 'class': 'right', 'style': 'margin-top:1.5rem;' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.hideModal
				}, _('Закрыть'))
			])
		]);
	},

	updateEventList: function() {
		var container = document.getElementById('events-timeline-container');
		if (container) {
			dom.content(container, this.renderEventItems());
		}
		var pager = document.getElementById('events-pager');
		if (pager) {
			dom.content(pager, this.renderPagerNodes());
		}
		var topLabel = document.getElementById('events-top-count');
		if (topLabel) {
			topLabel.innerText = this.events.length + _(' записей');
		}
	},

	exportCSV: function() {
		var filtered = this.getFiltered();
		function esc(v) {
			return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
		}
		var lines = ['time,category,level,title,desc,value,status'];
		filtered.forEach(function(ev) {
			lines.push([esc(ev.time), esc(ev.category), esc(ev.level), esc(ev.title), esc(ev.desc), esc(ev.value), esc(ev.status)].join(','));
		});
		var content = '\uFEFF' + lines.join('\n');
		var blob = new Blob([content], { type: 'text/plain' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = 'ups_manager_events_' + Math.floor(Date.now() / 1000) + '.csv';
		a.click();
		URL.revokeObjectURL(url);
	},

	refresh: function() {
		var self = this;
		return Promise.all([
			callGetOpsEvents().catch(function() { return { events: [] }; }),
			callGetQualityEvents().catch(function() { return { events: [] }; })
		]).then(function(data) {
			self.events = self.mergeEvents(data);
			self.updateEventList();
			ui.addNotification(null, E('p', {}, _('Журнал событий обновлён')), 'info');
		});
	}
});
