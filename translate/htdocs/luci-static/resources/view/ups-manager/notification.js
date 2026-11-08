'use strict';
'require view';
'require form';
'require rpc';
'require ui';

var callTestNotification = rpc.declare({
	object: 'luci.ups-manager',
	method: 'test_notification',
	expect: { '': {} }
});

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('ups_manager', _('Предупреждения о событиях и мгновенные push-уведомления'),
			_('При отключении или восстановлении сети, предупреждениях батареи или обрыве связи уведомления сразу отправляются на телефон через WeChat, DingTalk, Feishu, Bark и другие каналы.'));

		s = m.section(form.NamedSection, 'notification', 'notification', _('Настройка каналов уведомлений'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Включить push-уведомления'));
		o.default = '0';

		o = s.option(form.ListValue, 'channel', _('Канал отправки'));
		o.value('wechat', _('Бот WeChat Work'));
		o.value('dingtalk', _('Пользовательский бот DingTalk'));
		o.value('feishu', _('Пользовательский бот Feishu'));
		o.value('bark', _('Bark (простые push-уведомления для iOS)'));
		o.value('serverchan', _('Server酱·Turbo (уведомления WeChat)'));
		o.value('webhook', _('Пользовательский Webhook (универсальный JSON POST)'));
		o.default = 'webhook';

		o = s.option(form.Value, 'webhook_url', _('Адрес Webhook / URL отправки'));
		o.placeholder = 'https://oapi.dingtalk.com/robot/send?access_token=...';
		o.rmempty = false;

		o = s.option(form.Value, 'secret', _('Ключ подписи / токен доступа (необязательно)'));
		o.password = true; // Mask secret for security

		o = s.option(form.Value, 'repeat_interval', _('Интервал подавления повторных предупреждений (сек)'),
			_('События одного типа не отправляются повторно в течение этого интервала, чтобы не засыпать уведомлениями.'));
		o.datatype = 'uinteger';
		o.default = '600';

		// Test push button
		o = s.option(form.Button, '_test_notify', _('Тест отправки'));
		o.inputtitle = _('Отправить тестовое предупреждение');
		o.inputstyle = 'cbi-button-action';
		o.onclick = function() {
			ui.showModal(_('Отправка тестового сообщения...'), [
				E('p', { 'class': 'spinning' }, _('Вызов фонового канала уведомлений, подождите...'))
			]);

			return callTestNotification().then(function(res) {
				ui.hideModal();
				if (res && res.success) {
					ui.addNotification(null, E('p', {}, _('Тестовый запрос отправлен. Проверьте, пришло ли уведомление на телефон или в клиент.')), 'info');
				} else {
					ui.addNotification(null, E('p', {}, _('Ошибка тестовой отправки: ') + (res ? res.error : _('нет ответа'))), 'danger');
				}
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, E('p', {}, _('Ошибка вызова: ') + (err.message || err)), 'danger');
			});
		};

		s = m.section(form.NamedSection, 'notification', 'notification', _('Подписка на события-триггеры предупреждений'));
		s.anonymous = true;

		o = s.option(form.Flag, 'notify_on_battery', _('Отключение сети (переход на питание от батареи)'));
		o.default = '1';

		o = s.option(form.Flag, 'notify_on_online', _('Восстановление сети (возврат к питанию от сети)'));
		o.default = '1';

		o = s.option(form.Flag, 'notify_on_low_battery', _('Критически низкий заряд батареи (Low Battery)'));
		o.default = '1';

		o = s.option(form.Flag, 'notify_on_overload', _('Предупреждение о перегрузке ИБП'));
		o.default = '1';

		o = s.option(form.Flag, 'notify_on_comm_lost', _('Потеря или восстановление связи с ИБП'));
		o.default = '1';

		return m.render();
	}
});
