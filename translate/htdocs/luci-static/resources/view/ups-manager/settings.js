'use strict';
'require view';
'require form';
'require rpc';
'require ui';

var callScanDevices = rpc.declare({
	object: 'luci.ups-manager',
	method: 'scan_devices',
	expect: { '': {} }
});

var callTestConnection = rpc.declare({
	object: 'luci.ups-manager',
	method: 'test_connection',
	expect: { '': {} }
});

// Brand Presets Database
var BRAND_PRESETS = [
	{ id: 'cyberpower_usb', name: 'CyberPower - USB-HID (рекомендуется)', driver: 'usbhid-ups', port: 'auto', desc: 'CyberPower USB-HID UPS', baud: '' },
	{ id: 'apc_usb', name: 'APC / Schneider - USB-HID (Back-UPS и др.)', driver: 'usbhid-ups', port: 'auto', desc: 'APC USB-HID UPS', baud: '' },
	{ id: 'apc_serial', name: 'APC - Smart-UPS, последовательный порт (940-0024C и др.)', driver: 'apcsmart', port: '/dev/ttyS0', desc: 'APC Smart Serial', baud: '2400' },
	{ id: 'greencell_usb', name: 'GreenCell - UPSLP480 750VA (USB, Megatec)', driver: 'blazer_usb', port: 'auto', desc: 'GreenCell UPSLP480 750VA', baud: '', vendorid: '0665', productid: '5161', nominal_power: '450', voltage_low: '10.98', voltage_high: '12.60' },
	{ id: 'santak_usb', name: 'Santak - TG/MT/Castle, USB (Megatec)', driver: 'blazer_usb', port: 'auto', desc: 'Santak Megatec USB', baud: '' },
	{ id: 'santak_serial', name: 'Santak / Kehua - RS232, последовательный порт', driver: 'blazer_ser', port: '/dev/ttyUSB0', desc: 'Megatec RS232 Serial', baud: '2400' },
	{ id: 'eaton_usb', name: 'Eaton - USB-HID (Ellipse и др.)', driver: 'usbhid-ups', port: 'auto', desc: 'Eaton USB-HID', baud: '' },
	{ id: 'powercom_usb', name: 'Powercom - USB-HID', driver: 'usbhid-ups', port: 'auto', desc: 'Powercom USB', baud: '' },
	{ id: 'ladis_usb', name: 'Ladis - USB (Megatec)', driver: 'blazer_usb', port: 'auto', desc: 'Ladis Megatec USB', baud: '' },
	{ id: 'tripplite_usb', name: 'Tripp Lite - USB-HID', driver: 'usbhid-ups', port: 'auto', desc: 'Tripp Lite USB', baud: '' },
	{ id: 'snmp_net', name: 'Профессиональная SNMP-карта мониторинга (прямое подключение по IP)', driver: 'snmp-ups', port: '192.168.1.200', desc: 'Network SNMP Card', baud: '' }
];

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('ups_manager', _('Настройка оборудования и службы UPS Manager'),
			_('Поддержка ИБП разных производителей (CyberPower, APC, Santak, Eaton, Kehua, Ladis и др.) и протоколов USB-HID и Megatec через последовательный порт. Поддерживается автоматическое распознавание и заполнение в один клик.'));

		// 1. Hardware scan & preset tools
		s = m.section(form.NamedSection, 'ups', 'ups', _('Быстрое распознавание и пресеты производителей'));
		s.anonymous = true;

		// Brand Presets Dropdown
		o = s.option(form.ListValue, '_preset_selector', _('Пресеты конфигурации популярных производителей ИБП'),
			_('После выбора пресета автоматически заполнятся драйвер NUT, порт и шаблон конфигурации по умолчанию.'));
		o.value('', _('-- Выберите шаблон известного бренда --'));
		for (var i = 0; i < BRAND_PRESETS.length; i++) {
			o.value(BRAND_PRESETS[i].id, BRAND_PRESETS[i].name);
		}
		o.onchange = function(ev) {
			var val = ev.target.value;
			if (!val) return;
			var preset = BRAND_PRESETS.find(function(p) { return p.id === val; });
			if (!preset) return;

			var driverInput = document.querySelector('[name="cbid.ups_manager.ups.driver"]');
			var portInput = document.querySelector('[name="cbid.ups_manager.ups.port"]');
			var descInput = document.querySelector('[name="cbid.ups_manager.ups.desc"]');

			if (driverInput) driverInput.value = preset.driver;
			if (portInput) portInput.value = preset.port;
			if (descInput) descInput.value = preset.desc;
			var vidInput = document.querySelector('[name="cbid.ups_manager.ups.vendorid"]');
			var pidInput = document.querySelector('[name="cbid.ups_manager.ups.productid"]');
			var nomInput = document.querySelector('[name="cbid.ups_manager.ups.nominal_power"]');
			if (vidInput && preset.vendorid) vidInput.value = preset.vendorid;
			if (pidInput && preset.productid) pidInput.value = preset.productid;
			if (nomInput && preset.nominal_power) nomInput.value = preset.nominal_power;
			var vlInput = document.querySelector('[name="cbid.ups_manager.ups.battery_voltage_low"]');
			var vhInput = document.querySelector('[name="cbid.ups_manager.ups.battery_voltage_high"]');
			if (vlInput && preset.voltage_low) vlInput.value = preset.voltage_low;
			if (vhInput && preset.voltage_high) vhInput.value = preset.voltage_high;

			ui.addNotification(null, E('p', {}, _('Применён драйвер-пресет [') + preset.name + _(']. Сохраните и примените настройки.')), 'info');
		};

		// Scan Button
		o = s.option(form.Button, '_scan', _('Автоматическое сканирование оборудования'));
		o.inputtitle = _('🔍 Сканировать оборудование (USB / порт)');
		o.inputstyle = 'cbi-button-action';
		o.onclick = function() {
			ui.showModal(_('Сканирование физических устройств на всех шинах...'), [
				E('p', { 'class': 'spinning' }, _('Перебор устройств /sys/bus/usb и последовательных портов /dev/tty* и сверка с базой брендов, подождите...'))
			]);

			return callScanDevices().then(function(res) {
				ui.hideModal();
				var devices = (res && res.devices) ? res.devices : [];
				if (devices.length === 0) {
					ui.addNotification(null, E('p', {}, _('Подключённых USB или последовательных устройств не найдено. Проверьте кабели или убедитесь, что USB проброшен в виртуальную машину.')), 'warning');
					return;
				}

				var listNodes = [];
				for (var i = 0; i < devices.length; i++) {
					var d = devices[i];
					var isMatch = d.is_ups === 1;
					listNodes.push(E('div', {
						'style': 'padding:0.85rem;border:1px solid ' + (isMatch ? '#10b981' : 'var(--border-color-high, #cbd5e1)') + ';background:' + (isMatch ? 'rgba(16,185,129,0.08)' : 'var(--background-color-low, #ffffff)') + ';border-radius:0.5rem;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;'
					}, [
						E('div', {}, [
							E('div', { 'style': 'font-weight:700;font-size:0.95rem;' }, [
								(d.manufacturer ? d.manufacturer + ' — ' : '') + (d.product || _('Неизвестное устройство шины')),
								isMatch ? E('span', { 'style': 'background:rgba(16,185,129,0.22);color:var(--text-color-highest, #15803d);padding:2px 8px;border-radius:4px;font-size:0.75rem;margin-left:8px;' }, '✓ ' + _('Совпадает с сигнатурой ИБП')) : ''
							]),
							E('div', { 'style': 'color:var(--text-color-medium, #64748b);font-size:0.8rem;font-family:monospace;margin-top:0.25rem;' }, [
								'VID: ' + (d.vid || 'N/A') + ' | PID: ' + (d.pid || 'N/A') + (d.serial ? ' | S/N: ' + d.serial : '') + ' | Рекомендуемый драйвер: ' + d.recommended_driver
							])
						]),
						E('button', {
							'class': 'cbi-button ' + (isMatch ? 'cbi-button-apply' : 'cbi-button-neutral'),
							'data-vid': d.vid,
							'data-pid': d.pid,
							'data-serial': d.serial,
							'data-driver': d.recommended_driver,
							'click': function(e) {
								var btn = e.target;
								var vid = btn.getAttribute('data-vid');
								var pid = btn.getAttribute('data-pid');
								var serial = btn.getAttribute('data-serial');
								var driver = btn.getAttribute('data-driver');

								if (vid) document.querySelector('[name="cbid.ups_manager.ups.vendorid"]').value = vid;
								if (pid) document.querySelector('[name="cbid.ups_manager.ups.productid"]').value = pid;
								if (serial) document.querySelector('[name="cbid.ups_manager.ups.serial"]').value = serial;
								if (driver) document.querySelector('[name="cbid.ups_manager.ups.driver"]').value = driver;

								ui.hideModal();
								ui.addNotification(null, E('p', {}, _('Параметры и драйвер найденного оборудования заполнены. Нажмите внизу «Сохранить и применить».')), 'info');
							}
						}, _('Выбрать это устройство'))
					]));
				}

				ui.showModal(_('Список найденных физических устройств'), [
					E('div', { 'style': 'max-height:400px;overflow-y:auto;' }, listNodes),
					E('div', { 'class': 'right', 'style': 'margin-top:1rem;' }, [
						E('button', {
							'class': 'cbi-button cbi-button-neutral',
							'click': function() { ui.hideModal(); }
						}, _('Закрыть'))
					])
				]);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, E('p', {}, _('Ошибка сканирования: ') + (err.message || err)), 'danger');
			});
		};

		// Test connection button
		o = s.option(form.Button, '_test', _('Проверка связи с ИБП'));
		o.inputtitle = _('🔌 Проверить связь с ИБП сейчас');
		o.inputstyle = 'cbi-button-neutral';
		o.onclick = function() {
			ui.showModal(_('Проверка связи с ИБП...'), [
				E('p', { 'class': 'spinning' }, _('Выполняется проверка канала связи upsc, подождите...'))
			]);

			return callTestConnection().then(function(res) {
				ui.hideModal();
				if (res && res.success) {
					ui.addNotification(null, E('p', {}, _('Тест связи успешен! Найдено устройство: ') + (res.model || _('Готов')) + ' (' + _('время ответа') + ' ' + res.latency_sec + 's)'), 'info');
				} else {
					ui.addNotification(null, E('p', {}, _('Ошибка теста связи: ') + (res ? res.error : _('нет ответа')) + _('. Если есть конфликт, очистите остатки драйверов на странице обслуживания.')), 'danger');
				}
			});
		};

		// 2. Hardware parameters
		s = m.section(form.NamedSection, 'ups', 'ups', _('Драйвер и параметры связи'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'driver', _('Драйвер NUT'));
		o.value('usbhid-ups', _('usbhid-ups (универсальный USB-HID: CyberPower, APC, Santak USB и др.)'));
		o.value('blazer_usb', _('blazer_usb (USB-протокол Megatec: Santak, Kehua, Ladis и др.)'));
		o.value('blazer_ser', _('blazer_ser (RS-232, протокол Megatec: последовательный Santak, Kehua)'));
		o.value('apcsmart', _('apcsmart (последовательный протокол APC Smart)'));
		o.value('snmp-ups', _('snmp-ups (сетевая SNMP-карта)'));
		o.value('riello_usb', _('riello_usb (Riello USB)'));
		o.value('dummy-ups', _('dummy-ups (отладочный эмуляционный драйвер)'));
		o.default = 'usbhid-ups';

		o = s.option(form.Value, 'port', _('Порт связи / узел устройства'));
		o.default = 'auto';
		o.placeholder = 'auto или /dev/ttyUSB0 или 192.168.1.x';

		o = s.option(form.Value, 'vendorid', _('USB VendorID (необязательно)'), _('Например, CyberPower 0764, APC 051d, Santak 06da'));
		o.placeholder = '0764';

		o = s.option(form.Value, 'productid', _('USB ProductID (необязательно)'));
		o.placeholder = '0501';

		o = s.option(form.Value, 'nominal_power', _('Номинальная активная мощность (Вт)'),
			_('Если оборудование не передаёт realpower, система считает (номинальная мощность × загрузка). Для CyberPower UT650EGC рекомендуется 360, для TG500 — 300, для 1000VA — 600.'));
		o.datatype = 'uinteger';
		o.default = '360';

		o = s.option(form.Value, 'battery_voltage_low', _('Напряжение батареи при 0% (В)'),
			_('Порог, при котором заряд считается 0%. Для свинцово-кислотной батареи 12 В обычно 10.98 В (как в официальном приложении GreenCell).'));
		o.datatype = 'ufloat';
		o.placeholder = '10.98';

		o = s.option(form.Value, 'battery_voltage_high', _('Напряжение батареи при 100% (В)'),
			_('Порог, при котором заряд считается 100%. Для батареи 12 В обычно 12.60 В.'));
		o.datatype = 'ufloat';
		o.placeholder = '12.60';

		o = s.option(form.Value, 'power_scale', _('Коэффициент калибровки мощности (тонкая настройка)'),
			_('Используется для компенсации погрешности грубых ступенек АЦП внутри ИБП. Если фактическая мощность ниже расчётной, можно установить 0.8 или 0.9. По умолчанию 1.0.'));
		o.datatype = 'ufloat';
		o.default = '1.0';

		// 3. Security
		s = m.section(form.NamedSection, 'nut_service', 'nut_service', _('Служба NUT и безопасность сетевого прослушивания'));
		s.anonymous = true;

		o = s.option(form.Value, 'listen_address', _('IP-адрес для прослушивания'),
			_('🔒 Строгая защита: по умолчанию слушается только адрес 127.0.0.1. Не указывайте 0.0.0.0, чтобы не открыть порт управления в WAN или интернет.'));
		o.datatype = 'ip4addr';
		o.default = '127.0.0.1';

		o = s.option(form.Value, 'listen_port', _('Порт прослушивания службы'));
		o.datatype = 'port';
		o.default = '3493';

		return m.render();
	}
});
