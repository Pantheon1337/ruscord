/**
 * Скрипт для управления валютой пользователей (для администраторов)
 * 
 * Использование:
 *   tsx scripts/manage-currency.ts <userId> <operation> <amount>
 * 
 * Операции:
 *   set <amount> - установить точное количество валюты
 *   add <amount> - добавить валюту
 *   subtract <amount> - вычесть валюту
 * 
 * Примеры:
 *   tsx scripts/manage-currency.ts <user-id> set 5000
 *   tsx scripts/manage-currency.ts <user-id> add 1000
 *   tsx scripts/manage-currency.ts <user-id> subtract 500
 */

import { query } from "../src/database";
import dotenv from "dotenv";

dotenv.config();

async function manageCurrency(userId: string, operation: string, amount: number) {
  try {
    // Validate operation
    if (!['set', 'add', 'subtract'].includes(operation)) {
      console.error("Ошибка: операция должна быть 'set', 'add' или 'subtract'");
      process.exit(1);
    }

    // Validate amount
    if (isNaN(amount) || amount < 0) {
      console.error("Ошибка: количество должно быть положительным числом");
      process.exit(1);
    }

    // Check if user exists
    const userCheck = await query(
      `SELECT id, username FROM users WHERE id = $1`,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      console.error(`Ошибка: пользователь с ID ${userId} не найден`);
      process.exit(1);
    }

    const user = userCheck.rows[0];
    console.log(`Пользователь: ${user.username} (${userId})`);

    // Get current currency
    const currentResult = await query(
      `SELECT rucoin_amount FROM user_currency WHERE user_id = $1`,
      [userId]
    );

    let currentAmount = 0;
    if (currentResult.rows.length === 0) {
      console.log("Валютный счет не найден, будет создан новый");
    } else {
      currentAmount = parseInt(currentResult.rows[0].rucoin_amount);
      console.log(`Текущий баланс: ${currentAmount.toLocaleString()} 🪙`);
    }

    // Calculate new amount
    let newAmount = 0;
    if (operation === 'set') {
      newAmount = amount;
    } else if (operation === 'add') {
      newAmount = currentAmount + amount;
    } else {
      newAmount = Math.max(0, currentAmount - amount);
    }

    // Update currency
    if (currentResult.rows.length === 0) {
      await query(
        `INSERT INTO user_currency (user_id, rucoin_amount, updated_at) VALUES ($1, $2, NOW())`,
        [userId, newAmount]
      );
    } else {
      await query(
        `UPDATE user_currency SET rucoin_amount = $1, updated_at = NOW() WHERE user_id = $2`,
        [newAmount, userId]
      );
    }

    console.log(`\n✅ Операция выполнена успешно!`);
    console.log(`Операция: ${operation}`);
    console.log(`Изменение: ${operation === 'set' ? 'установлено' : operation === 'add' ? `+${amount.toLocaleString()}` : `-${amount.toLocaleString()}`}`);
    console.log(`Новый баланс: ${newAmount.toLocaleString()} 🪙`);

    process.exit(0);
  } catch (error) {
    console.error("Ошибка при выполнении операции:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 3) {
  console.error("Использование: tsx scripts/manage-currency.ts <userId> <operation> <amount>");
  console.error("Операции: set, add, subtract");
  console.error("Пример: tsx scripts/manage-currency.ts <user-id> add 1000");
  process.exit(1);
}

const [userId, operation, amountStr] = args;
const amount = parseInt(amountStr);

if (isNaN(amount)) {
  console.error("Ошибка: количество должно быть числом");
  process.exit(1);
}

// Run the script
manageCurrency(userId, operation, amount);

