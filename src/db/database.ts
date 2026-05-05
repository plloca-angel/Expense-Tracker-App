import * as SQLite from 'expo-sqlite';
import type { Expense } from '../types/expense';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync('expenses.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      tag TEXT,
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  dbInstance = db;
  return db;
}

type Row = {
  id: number;
  amount: number;
  category: string;
  tag: string | null;
  note: string | null;
  date: string;
  created_at: string;
};

function mapRow(r: Row): Expense {
  return {
    id: r.id,
    amount: r.amount,
    category: r.category,
    tag: r.tag,
    note: r.note,
    date: r.date,
    createdAt: r.created_at,
  };
}

export async function fetchAllExpenses(db: SQLite.SQLiteDatabase): Promise<Expense[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT id, amount, category, tag, note, date, created_at FROM expenses ORDER BY date DESC, id DESC'
  );
  return rows.map(mapRow);
}

export type NewExpenseInput = {
  amount: number;
  category: string;
  tag?: string | null;
  note?: string | null;
  date: string;
};

export async function insertExpense(db: SQLite.SQLiteDatabase, input: NewExpenseInput): Promise<void> {
  const created = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO expenses (amount, category, tag, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    input.amount,
    input.category,
    input.tag ?? null,
    input.note ?? null,
    input.date,
    created
  );
}

export async function deleteExpense(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}
