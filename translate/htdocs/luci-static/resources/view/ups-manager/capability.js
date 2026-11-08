'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callGetRawData = rpc.declare({
	object: 'luci.ups-manager',
	method: 'get_raw_data',
	expect: { '': {} }
});

// NUT Field dictionary for human-friendly explanation and units
var NUT_DICT = {
	'battery.charge': { label: 'Остаток заряда батареи', unit: '%', type: 'measured', desc: 'Текущий заряд аккумуляторной батареи в процентах' },
	'battery.charge.low': { label: 'Порог предупреждения о низком заряде', unit: '%', type: 'reported', desc: 'Заданный на устройстве порог, при котором включается статус LB' },
	'battery.charge.warning': { label: 'Порог предупреждения по заряду', unit: '%', type: 'reported', desc: 'Порог заряда, при котором отправляется предупреждение' },
	'battery.runtime': { label: 'Ожидаемое время работы от батареи', unit: 'сек', type: 'measured', desc: 'Расчётное время работы от батареи при текущей нагрузке' },
	'battery.runtime.low': { label: 'Порог предупреждения о малом времени работы', unit: 'сек', type: 'reported', desc: 'Порог времени, при котором отправляется предупреждение о малом времени работы' },
	'battery.voltage': { label: 'Напряжение батареи', unit: 'V', type: 'measured', desc: 'Общее рабочее напряжение аккумуляторной батареи' },
	'battery.voltage.nominal': { label: 'Номинальное напряжение батареи', unit: 'V', type: 'reported', desc: 'Стандартное номинальное напряжение аккумуляторной батареи' },
	'battery.type': { label: 'Тип батареи', unit: '', type: 'reported', desc: 'Химический тип батареи (например, PbAc, Li-ion)' },
	'device.mfr': { label: 'Производитель устройства', unit: '', type: 'reported', desc: 'Производитель оборудования ИБП' },
	'device.model': { label: 'Модель устройства', unit: '', type: 'reported', desc: 'Модель оборудования ИБП' },
	'device.serial': { label: 'Серийный номер устройства', unit: '', type: 'reported', desc: 'Уникальный заводской номер устройства' },
	'device.type': { label: 'Класс устройства', unit: '', type: 'reported', desc: 'Общий класс оборудования (ups)' },
	'driver.name': { label: 'Драйвер NUT', unit: '', type: 'system', desc: 'Драйвер NUT для связи с этим оборудованием' },
	'driver.version': { label: 'Версия драйвера NUT', unit: '', type: 'system', desc: 'Внутренний номер версии драйвера NUT' },
	'driver.version.internal': { label: 'Внутренняя сборка драйвера', unit: '', type: 'system', desc: 'Номер сборки драйвера' },
	'input.voltage': { label: 'Входное напряжение сети', unit: 'V', type: 'measured', desc: 'Фактическое входное напряжение сети переменного тока' },
	'input.voltage.nominal': { label: 'Номинальное напряжение сети', unit: 'V', type: 'reported', desc: 'Стандартное напряжение сети (например, 220 В)' },
	'input.frequency': { label: 'Частота входа сети', unit: 'Hz', type: 'measured', desc: 'Текущая промышленная частота сети переменного тока' },
	'input.frequency.nominal': { label: 'Номинальная частота сети', unit: 'Hz', type: 'reported', desc: 'Стандартная промышленная частота сети (50 Гц / 60 Гц)' },
	'output.voltage': { label: 'Выходное напряжение инвертора', unit: 'V', type: 'measured', desc: 'Переменное напряжение, подаваемое на подключённые устройства' },
	'output.voltage.nominal': { label: 'Номинальное выходное напряжение', unit: 'V', type: 'reported', desc: 'Целевое стандартное выходное напряжение инвертора' },
	'output.frequency': { label: 'Частота выхода инвертора', unit: 'Hz', type: 'measured', desc: 'Промышленная частота на выходе' },
	'output.current': { label: 'Фактический выходной ток', unit: 'A', type: 'measured', desc: 'Измеренный ток нагрузки на выходе' },
	'ups.load': { label: 'Текущая загрузка', unit: '%', type: 'measured', desc: 'Доля нагрузки относительно номинальной мощности' },
	'ups.realpower': { label: 'Активная выходная мощность', unit: 'W', type: 'measured', desc: 'Измеренная активная мощность устройства' },
	'ups.realpower.nominal': { label: 'Номинальная активная мощность', unit: 'W', type: 'reported', desc: 'Максимальная расчётная активная мощность оборудования' },
	'ups.power.nominal': { label: 'Номинальная полная мощность', unit: 'VA', type: 'reported', desc: 'Максимальная расчётная полная мощность оборудования' },
	'ups.status': { label: 'Код состояния работы', unit: '', type: 'measured', desc: 'OL (питание от сети), OB (питание от батареи), LB (низкий заряд) и др.' },
	'ups.temperature': { label: 'Внутренняя температура устройства', unit: '°C', type: 'measured', desc: 'Показание датчика температуры инвертора или корпуса' },
	'ups.mfr': { label: 'Название производителя ИБП', unit: '', type: 'reported', desc: 'Строка производителя, возвращаемая протоколом ИБП' },
	'ups.model': { label: 'Название модели ИБП', unit: '', type: 'reported', desc: 'Строка модели, возвращаемая протоколом ИБП' },
	'ups.serial': { label: 'Серийный номер ИБП', unit: '', type: 'reported', desc: 'Серийный номер, возвращаемый прошивкой ИБП' },
	'ups.beeper.status': { label: 'Состояние зуммера', unit: '', type: 'reported', desc: 'enabled (включён) / disabled (выключен)' },
	'ups.test.result': { label: 'Результат последней самодиагностики', unit: '', type: 'reported', desc: 'Статус самодиагностики (Done and passed и др.)' }
};

return view.extend({
	rawResult: null,

	load: function() {
		return callGetRawData();
	},

	render: function(res) {
		var self = this;
		self.rawResult = res;

		var mobileStyle = E('style', {}, [
			'@media (max-width: 600px) { .cap-actions { justify-content: stretch !important; } .cap-actions .cbi-button { flex: 1 1 100%; text-align: center; } .cbi-map-title { font-size: 1.15rem !important; line-height: 1.3; } .cbi-map-descr { font-size: 0.88rem; } }'
		]);

		var container = E('div', { 'class': 'cbi-map' }, [
			mobileStyle,
			E('h2', { 'class': 'cbi-map-title' }, _('Определение возможностей ИБП и сопоставление исходных данных')),
			E('div', { 'class': 'cbi-map-descr' }, _('Чтение всех полей устройства по протоколу NUT upsc и построение словаря возможностей. Режим только для чтения: опасные команды управления ИБП не отправляются.'))
		]);

		var actionBar = E('div', { 'class': 'cap-actions', 'style': 'margin-bottom:1rem;display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:flex-end;' }, [
			E('button', {
				'class': 'cbi-button cbi-button-action',
				'click': function() {
					self.exportJson();
				}
			}, _('Экспорт отчёта о возможностях (JSON)')),
			E('button', {
				'class': 'cbi-button cbi-button-neutral',
				'click': function() {
					self.exportRawText();
				}
			}, _('Экспорт исходного текста NUT (Raw)'))
		]);

		var table = E('table', { 'class': 'table cbi-section-table', 'style': 'width:100%;' }, [
			E('thead', {}, [
				E('tr', { 'class': 'tr cbi-section-table-titles' }, [
					E('th', { 'class': 'th', 'style': 'width:25%;' }, _('Исходное поле NUT')),
					E('th', { 'class': 'th', 'style': 'width:18%;' }, _('Исходное значение')),
					E('th', { 'class': 'th', 'style': 'width:20%;' }, _('Описание и единицы')),
					E('th', { 'class': 'th', 'style': 'width:15%;' }, _('Категория данных')),
					E('th', { 'class': 'th', 'style': 'width:22%;' }, _('Описание'))
				])
			]),
			E('tbody', { 'id': 'capability-table-body' }, self.renderRows(res))
		]);

		dom.append(container, [actionBar, table]);
		return container;
	},

	renderRows: function(res) {
		if (!res || !res.success || !res.fields) {
			return [
				E('tr', {}, [
					E('td', { 'colspan': '5', 'style': 'text-align:center;color:#ef4444;padding:2rem;' },
						_('Не удалось прочитать исходные поля ИБП, причина: ') + (res ? res.error : _('связь не готова'))
					)
				])
			];
		}

		var keys = Object.keys(res.fields).sort();
		if (keys.length === 0) {
			return [
				E('tr', {}, [
					E('td', { 'colspan': '5', 'style': 'text-align:center;padding:2rem;' }, _('Данные полей не обнаружены'))
				])
			];
		}

		var rows = [];
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			var v = res.fields[k];
			var meta = NUT_DICT[k] || { label: k, unit: '', type: 'custom', desc: _('Дополнительное или нестандартное поле') };

			var tagClass = 'cbi-button-neutral';
			var tagLabel = _('Данные устройства');
			if (meta.type === 'measured') {
				tagClass = 'cbi-button-apply';
				tagLabel = _('Измерено датчиком');
			} else if (meta.type === 'system') {
				tagClass = 'cbi-button-action';
				tagLabel = _('Система/драйвер');
			}

			rows.push(E('tr', { 'class': 'tr cbi-section-table-row' }, [
				E('td', { 'class': 'td', 'style': 'font-family:monospace;font-weight:600;' }, k),
				E('td', { 'class': 'td', 'style': 'font-family:monospace;color:#2563eb;' }, v),
				E('td', { 'class': 'td' }, [
					meta.label,
					meta.unit ? E('span', { 'style': 'color:var(--text-color-medium, #64748b);margin-left:4px;' }, '(' + meta.unit + ')') : ''
				]),
				E('td', { 'class': 'td' }, [
					E('span', { 'class': 'cbi-button ' + tagClass, 'style': 'padding:2px 8px;font-size:0.75rem;cursor:default;' }, tagLabel)
				]),
				E('td', { 'class': 'td', 'style': 'color:var(--text-color-medium, #64748b);font-size:0.85rem;' }, meta.desc)
			]));
		}

		return rows;
	},

	exportJson: function() {
		var content = JSON.stringify(this.rawResult, null, 2);
		var blob = new Blob([content], { type: 'application/json' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = 'ups_capability_report_' + Math.floor(Date.now() / 1000) + '.json';
		a.click();
		URL.revokeObjectURL(url);
	},

	exportRawText: function() {
		if (!this.rawResult || !this.rawResult.fields) return;
		var lines = [];
		var keys = Object.keys(this.rawResult.fields).sort();
		for (var i = 0; i < keys.length; i++) {
			lines.push(keys[i] + ': ' + this.rawResult.fields[keys[i]]);
		}
		var content = lines.join('\n');
		var blob = new Blob([content], { type: 'text/plain' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = 'nut_raw_fields_' + Math.floor(Date.now() / 1000) + '.txt';
		a.click();
		URL.revokeObjectURL(url);
	}
});
