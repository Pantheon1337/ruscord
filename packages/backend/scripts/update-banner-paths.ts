/**
 * Скрипт для обновления путей к баннерам после загрузки изображений
 * 
 * Использование:
 *   tsx scripts/update-banner-paths.ts
 */

import { query } from "../src/database";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function updateBannerPaths() {
  try {
    console.log("Проверка и обновление путей к баннерам...\n");

    const bannersDir = path.join(process.cwd(), "uploads", "banners");
    
    // Проверяем существование папки
    if (!fs.existsSync(bannersDir)) {
      console.log("Папка uploads/banners не найдена. Создаю...");
      fs.mkdirSync(bannersDir, { recursive: true });
    }

    // Получаем список файлов в папке
    const files = fs.readdirSync(bannersDir).filter(file => 
      /\.(png|jpg|jpeg|webp)$/i.test(file)
    );

    console.log(`Найдено изображений в папке: ${files.length}`);
    files.forEach(file => console.log(`  - ${file}`));
    console.log();

    // Обновляем пути для существующих баннеров
    const banners = [
      { name: 'Тестовый баннер 1', file: 'banner1.png' },
      { name: 'Тестовый баннер 2', file: 'banner2.png' },
      { name: 'Тестовый баннер 3', file: 'banner3.png' }
    ];

    for (const banner of banners) {
      const filePath = path.join(bannersDir, banner.file);
      const imageUrl = `/uploads/banners/${banner.file}`;

      if (fs.existsSync(filePath)) {
        await query(`
          UPDATE shop_items 
          SET image_url = $1 
          WHERE name = $2 AND type = 'banner'
        `, [imageUrl, banner.name]);
        console.log(`✅ Обновлен путь для "${banner.name}": ${imageUrl}`);
      } else {
        console.log(`⚠️  Файл не найден для "${banner.name}": ${banner.file}`);
        console.log(`   Загрузите изображение в: ${filePath}`);
      }
    }

    console.log("\n✅ Обновление завершено!");
    console.log("\nИнструкции:");
    console.log("1. Загрузите недостающие изображения баннеров в папку:");
    console.log(`   ${bannersDir}`);
    console.log("2. Рекомендуемый размер: 600x240 пикселей (соотношение 2.5:1)");
    console.log("3. Формат: PNG или JPG");
    console.log("4. Имена файлов: banner1.png, banner2.png, banner3.png");
    console.log("5. После загрузки запустите этот скрипт снова для обновления путей");

    process.exit(0);
  } catch (error) {
    console.error("Ошибка при обновлении путей:", error);
    process.exit(1);
  }
}

updateBannerPaths();

