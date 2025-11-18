# Как пополнить баланс монет

## Способ 1: Через интерфейс магазина

1. Откройте магазин в приложении
2. Нажмите кнопку **"Пополнить"** в правом верхнем углу
3. Введите сумму или выберите из предложенных вариантов (500, 1000, 5000, 10000)
4. Нажмите **"Пополнить баланс"**

## Способ 2: Через API (для администраторов)

### Использование скрипта manage-currency.ts

```bash
cd packages/backend
npx tsx scripts/manage-currency.ts <userId> <operation> <amount>
```

**Параметры:**
- `userId` - ID пользователя (UUID)
- `operation` - операция: `add`, `set`, `subtract`
- `amount` - количество монет

**Примеры:**

```bash
# Добавить 1000 монет пользователю
npx tsx scripts/manage-currency.ts 123e4567-e89b-12d3-a456-426614174000 add 1000

# Установить баланс в 5000 монет
npx tsx scripts/manage-currency.ts 123e4567-e89b-12d3-a456-426614174000 set 5000

# Вычесть 500 монет
npx tsx scripts/manage-currency.ts 123e4567-e89b-12d3-a456-426614174000 subtract 500
```

### Использование API напрямую

**POST** `/api/shop/admin/currency`

**Headers:**
```
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "operation": "add",
  "amount": 1000
}
```

**Операции:**
- `add` - добавить к текущему балансу
- `set` - установить точное значение
- `subtract` - вычесть из текущего баланса

**Ответ:**
```json
{
  "success": true,
  "new_amount": 1500,
  "message": "Currency updated successfully"
}
```

## Способ 3: Напрямую через SQL

```sql
-- Добавить монеты
UPDATE user_currency 
SET rucoin_amount = rucoin_amount + 1000 
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000';

-- Установить точное значение
UPDATE user_currency 
SET rucoin_amount = 5000 
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000';

-- Проверить баланс
SELECT rucoin_amount 
FROM user_currency 
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000';
```

## Как узнать свой User ID?

1. Откройте консоль браузера (F12)
2. Введите: `localStorage.getItem('token')`
3. Скопируйте токен
4. Используйте API: `GET /api/users/me` с заголовком `Authorization: Bearer <token>`
5. В ответе будет поле `id` - это ваш User ID

Или просто используйте кнопку "Пополнить" в интерфейсе магазина - она автоматически определит ваш ID.

