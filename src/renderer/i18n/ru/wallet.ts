import { WalletMessages } from '../types'

const wallet: WalletMessages = {
  'wallet.name': 'Название кошелька',
  'wallet.name.maxChars': 'Макс. {max} символов',
  'wallet.name.error.empty': 'Пожалуйста, введите название для вашего кошелька',
  'wallet.name.error.duplicated': 'Такое название уже существует, пожалуйста, используйте другое',
  'wallet.name.error.rename': 'Ошибка при переименовании кошелька',
  'wallet.nav.deposits': 'Вклады',
  'wallet.nav.bonds': 'Бонды',
  'wallet.nav.poolshares': 'Доли',
  'wallet.nav.savers': 'Сбережения',
  'wallet.column.name': 'Имя',
  'wallet.column.ticker': 'Тикер',
  'wallet.action.send': 'Отправить',
  'wallet.action.receive': 'Получить',
  'wallet.action.receive.title': 'Получить {asset}',
  'wallet.action.forget': 'Забыть',
  'wallet.action.unlock': 'Разблокировать',
  'wallet.action.import': 'Импортировать',
  'wallet.action.create': 'Создать',
  'wallet.action.connect': 'Подключить',
  'wallet.action.deposit': 'Вложить',
  'wallet.balance.total.poolAssets': 'Общий баланс активов кошелька',
  'wallet.balance.total.poolAssets.info':
    'Общий баланс активов кошелька с использованием данных пулов от Thorchain & Mayachain. Пулы являются источником истины для определения цен в THORChain.',
  'wallet.shares.total': 'Итоговая стоимость',
  'wallet.connect.instruction': 'Пожалуйста подключите ваш кошелёк',
  'wallet.lock.label': 'Заблокировать кошелёк',
  'wallet.unlock.label': 'Разблокировать кошелёк',
  'wallet.unlock.title': 'Разблокировать "{name}"',
  'wallet.unlock.instruction': 'Пожалуйста разблокируйте ваш кошелёк',
  'wallet.unlock.password': 'Введите ваш пароль',
  'wallet.unlock.error': 'Не получилось разблокировать кошелёк. Пожалуйста, проверьте пароль и попробуйте еще раз.',
  'wallet.imports.phrase.title': 'Пожалуйста, введите фразу вашего кошелька с одинарным пробелом между словами',
  'wallet.imports.wallet': 'Импортировать существующий кошелёк',
  'wallet.imports.keystore.select': 'Выберите keystore файл',
  'wallet.imports.keystore.title': 'Выберите файл для загрузки',
  'wallet.imports.enterphrase': 'Введите фразу',
  'wallet.imports.error.instance': 'Не удалось создать экземпляр Клиента',
  'wallet.imports.error.keystore.load': 'Недопустимый Keystore',
  'wallet.imports.error.keystore.import': 'Ошибка при импорте keystore кошельков',
  'wallet.imports.error.ledger.import': 'Ошибка при попытке импортировать счета Ledger',
  'wallet.imports.error.keystore.password': 'Неверный пароль',
  'wallet.phrase.error.valueRequired': 'Необходимо значение для фразы',
  'wallet.phrase.error.invalid': 'Неверная фраза',
  'wallet.phrase.error.import': 'Ошибка при импорте фразы',
  'wallet.imports.error.phrase.empty': 'Импортировать существующий кошелёк с балансом',
  'wallet.txs.history': 'История переводов',
  'wallet.txs.history.disabled': 'История транзакций для {chain} была временно отключена',
  'wallet.create.copy.phrase': 'Скопируйте фразу ниже',
  'wallet.create.error.phrase.empty': 'Создать новый кошелёк с балансом',
  'wallet.add.another': 'Добавить еще один кошелёк',
  'wallet.add.label': 'Добавить кошелёк',
  'wallet.change.title': 'Сменить кошелёк',
  'wallet.change.error': 'Ошибка во время смены кошелька',
  'wallet.selected.title': 'Выбрать кошелёк',
  'wallet.create.title': 'Создать новый кошелёк',
  'wallet.create.enter.phrase': 'Введите фразу правильно',
  'wallet.create.error.phrase': 'Сохраните вашу фразу в надежном месте и введите ее в правильном порядке',
  'wallet.create.words.click': 'Выберите слова в правильном порядке',
  'wallet.create.creating': 'Создание кошелька',
  'wallet.create.error': 'Ошибка при сохранении фразы',
  'wallet.receive.address.error': 'Нет доступных адресов для получения',
  'wallet.receive.address.errorQR': 'Ошибка при создании QR-кода: {error}',
  'wallet.remove.label': 'Забыть кошелек',
  'wallet.remove.label.title': 'Вы уверены, что хотите забыть "{name}"?',
  'wallet.remove.label.description':
    'Для повторного создания кошелька вам потребуется указать свою фразу. Пожалуйста, убедитесь, что ваша фраза сохранена в надежном месте, прежде чем продолжить.',
  'wallet.send.success': 'Транзакция завершена.',
  'wallet.send.fastest': 'Наибыстро',
  'wallet.send.fast': 'Быстро',
  'wallet.send.affiliateTracking': 'Обнаружено мемо обмена, применена партнерская комиссия 10 базисных пунктов',
  'wallet.send.notAllowed': 'Не разрешено',
  'wallet.send.average': 'Среднее',
  'wallet.send.fundsLoss': 'Средства будут потеряны при отправке на этот адрес.',
  'wallet.send.max.doge':
    'Рассчитанное макс. значение основано на приблизительных комиссиях, которые могут быть иногда неточны для DOGE. В случае появления сообщения об ошибке "Недостаточно средств для проведения операции" проверьте https://blockchair.com/dogecoin/transactions, чтобы получить среднее значение последних сборов и вычесть его из баланса перед отправкой транзакции.',
  'wallet.errors.balancesFailed': 'Нет загруженных балансов. {errorMsg}',
  'wallet.errors.asset.notExist': 'Отсутствует актив {asset}',
  'wallet.errors.address.empty': 'Адрес не может быть пустым',
  'wallet.errors.address.invalid': 'Адрес недействителен',
  'wallet.errors.address.inbound': 'Осторожно обнаружен входящий адрес',
  'wallet.errors.address.couldNotFind': 'Не удалось найти адрес для пула {pool}',
  'wallet.errors.amount.shouldBeNumber': 'Количество должно быть числом',
  'wallet.errors.amount.shouldBeGreaterThan': 'Количество должно быть больше, чем {amount}',
  'wallet.errors.amount.shouldBeGreaterOrEqualThan': 'Количество должно быть равно или больше {amount}',
  'wallet.errors.amount.shouldBeLessThanBalance': 'Количество должно быть меньше вашего баланса',
  'wallet.errors.amount.shouldBeLessThanBalanceAndFee':
    'Количество должно быть меньше, чем ваш баланс после вычета комиссии',
  'wallet.errors.fee.notCovered': 'Комиссия не покрывается вашим балансом ({balance})',
  'wallet.errors.invalidChain': 'Неверная цепочка: {chain}',
  'wallet.errors.memo.max': 'Длина мемо не может быть больше, чем {max}',
  'wallet.password.confirmation.title': 'Подтверждение пароля',
  'wallet.password.confirmation.description': 'Пожалуйста введите свой пароль',
  'wallet.password.confirmation.pending': 'Проверяю пароль',
  'wallet.password.empty': 'Пожалуйста, введите пароль',
  'wallet.password.confirmation.error': 'Неверный пароль',
  'wallet.password.repeat': 'Повторите пароль',
  'wallet.password.mismatch': 'Пароли не совпадают',
  'wallet.send.error': 'Ошибка отправки',
  'wallet.validations.lessThen': 'Должно быть меньше, чем {value}',
  'wallet.validations.graterThen': 'Должно быть больше, чем {value}',
  'wallet.validations.shouldNotBeEmpty': 'Не должно быть пустым',
  'wallet.ledger.verifyAddress.modal.title': 'Проверка адреса Ledger',
  'wallet.ledger.verifyAddress.modal.description': 'Проверьте адрес {address} на вашем устройстве',
  'wallet.ledger.removeAddress': 'Удалить адрес Ledger для цепочки {chain}',
  'wallet.ledger.viewAddress': 'Просмотреть адрес в проводнике'
}

export default wallet
