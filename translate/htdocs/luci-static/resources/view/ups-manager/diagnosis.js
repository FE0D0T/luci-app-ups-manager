'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callDiagnose = rpc.declare({
	object: 'luci.ups-manager',
	method: 'diagnose',
	expect: { '': {} }
});

var callClearLogs = rpc.declare({
	object: 'luci.ups-manager',
	method: 'clear_logs',
	expect: { '': {} }
});

var callGetLogs = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_logs',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			callDiagnose(),
			callGetLogs()
		]);
	},

	render: function(data) {
		var self = this;
		var diag = data[0] || {};
		var logs = data[1] || {};

		var diagStyle = E('style', {}, [
			'.cbi-button { text-align: center; justify-content: center; } @media (max-width: 600px) { .diag-head { flex-direction: column; align-items: stretch; } .diag-actions { width: 100%; } .diag-actions .cbi-button { flex: 1 1 auto; } }'
		]);

		var container = E('div', { 'class': 'cbi-map' }, [
			diagStyle,
			E('h2', { 'class': 'cbi-map-title' }, _('Журнал работы и диагностика обслуживания системы')),
			E('div', { 'class': 'cbi-map-descr' }, _('Проверка в реальном времени демона NUT, процесса драйвера, монтирования узла шины USB и состояния безопасного прослушивания. Диагностика только читает данные: службы не перезапускаются и питание не отключается.'))
		]);

		// Diagnosis items
		var checkSection = E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'diag-head', 'style': 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:1rem;' }, [
				E('h3', { 'class': 'cbi-section-title', 'style': 'margin:0;' }, _('Диагностика состояния системы')),
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': function() {
						return callDiagnose().then(function(newDiag) {
							var body = document.getElementById('diag-table-body');
							if (body) dom.content(body, self.renderDiagRows(newDiag));
							ui.addNotification(null, E('p', {}, _('Диагностика завершена, статус проверки обновлён.')), 'info');
						});
					}
				}, _('Запустить диагностику повторно'))
			]),
			E('table', { 'class': 'table cbi-section-table', 'style': 'width:100%;' }, [
				E('thead', {}, [
					E('tr', { 'class': 'tr cbi-section-table-titles' }, [
						E('th', { 'class': 'th', 'style': 'width:25%;' }, _('Проверяемый пункт')),
						E('th', { 'class': 'th', 'style': 'width:15%;' }, _('Статус результата')),
						E('th', { 'class': 'th', 'style': 'width:60%;' }, _('Подробности диагностики и рекомендации'))
					])
				]),
				E('tbody', { 'id': 'diag-table-body' }, self.renderDiagRows(diag))
			])
		]);

		// Logs section
		var logSection = E('div', { 'class': 'cbi-section', 'style': 'margin-top:2rem;' }, [
			E('div', { 'class': 'diag-head', 'style': 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:1rem;' }, [
				E('h3', { 'class': 'cbi-section-title', 'style': 'margin:0;' }, _('Журнал системных событий и связи')),
				E('div', { 'class': 'diag-actions', 'style': 'display:flex;flex-wrap:wrap;gap:0.5rem;' }, [
					E('a', {
						'class': 'cbi-button cbi-button-action',
						'href': L.url('admin/services/ups_manager/events')
					}, _('⏱️ Открыть историю событий')),
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'click': function() {
							return callGetLogs().then(function(newLogs) {
								var pre = document.getElementById('log-viewer-pre');
								if (pre) pre.innerText = (newLogs.logs && newLogs.logs.length) ? newLogs.logs.join('\n') : _('Данных журнала пока нет');
							});
						}
					}, _('Обновить журнал')),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': function() {
							var pre = document.getElementById('log-viewer-pre');
							var text = pre ? pre.innerText : '';
							var blob = new Blob([text], { type: 'text/plain' });
							var url = URL.createObjectURL(blob);
							var a = document.createElement('a');
							a.href = url;
							a.download = 'ups_manager_events_' + Math.floor(Date.now() / 1000) + '.log';
							a.click();
							URL.revokeObjectURL(url);
						}
					}, _('Экспорт текста журнала')),
					E('button', {
						'class': 'cbi-button cbi-button-reset',
						'click': function() {
							if (!confirm('Очистить журнал диагностики? Записи будут удалены.')) return;
							return callClearLogs().then(function() {
								var pre = document.getElementById('log-viewer-pre');
								if (pre) pre.innerText = _('Журнал очищен');
								ui.addNotification(null, E('p', {}, _('Журнал диагностики очищен.')), 'info');
							});
						}
					}, _('Очистить журнал'))
				])
			]),
			E('pre', {
				'id': 'log-viewer-pre',
				'style': 'background:#0f172a;color:#e2e8f0;padding:1.25rem;border-radius:0.5rem;font-size:0.85rem;max-height:400px;overflow-y:auto;line-height:1.5;'
			}, (logs.logs && logs.logs.length) ? logs.logs.join('\n') : _('Данных журнала пока нет'))
		]);

		dom.append(container, [checkSection, logSection]);
		return container;
	},

	renderDiagRows: function(diag) {
		var checks = (diag && diag.checks) ? diag.checks : [];
		if (checks.length === 0) {
			return [
				E('tr', {}, [
					E('td', { 'colspan': '3', 'style': 'text-align:center;padding:1rem;' }, _('Данные диагностики не получены'))
				])
			];
		}

		var rows = [];
		for (var i = 0; i < checks.length; i++) {
			var c = checks[i];
			var badgeClass = 'cbi-button-apply';
			var badgeText = '✓ Норма';
			if (c.status === 'warning') {
				badgeClass = 'cbi-button-neutral';
				badgeText = '⚠ Предупреждение';
			} else if (c.status === 'error') {
				badgeClass = 'cbi-button-reset';
				badgeText = '✕ Ошибка';
			}

			rows.push(E('tr', { 'class': 'tr cbi-section-table-row' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:600;' }, c.title),
				E('td', { 'class': 'td' }, [
					E('span', { 'class': 'cbi-button ' + badgeClass, 'style': 'padding:2px 8px;font-size:0.75rem;cursor:default;' }, badgeText)
				]),
				E('td', { 'class': 'td' }, c.message)
			]));
		}

		return rows;
	}
});
