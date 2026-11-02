import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  CategoryValue,
  GroupCategory,
  MemberCategory,
} from '@/domain/category';
import type { CollectionItem } from '@/domain/collection-item';
import type { Collectible } from '@/domain/collectible';

const DATABASE_VERSION = 6;

export type PhotocardEmbedding = {
  collectionItemId: string;
  modelVersion: string;
  vector: number[];
};

export type PhotocardCatalogInput = {
  group: CategoryValue | null;
  member: CategoryValue | null;
  album: string;
  version: string;
  era: string;
  itemEvent: string;
  acquisitionEvent: string;
  customCategories: string[];
  favorite: boolean;
  wanted: boolean;
  rating: CollectionItem['rating'];
  notes: string;
};

type CollectionItemRow = {
  id: string;
  type: string;
  imageUri: string;
  createdAt: string;
  updatedAt: string;
  favorite: number;
  owned: number;
  wanted: number;
  isCatalogued: number;
  quantity: number;
  rating: number;
  notes: string | null;
  size: string | null;
  eventDate: string | null;
};

type CollectionItemCategoryRow = {
  collectionItemId: string;
  field: string;
  categoryId: string;
  value: string;
  position: number;
};

type PhotocardSize = 'little' | 'medium' | 'large' | 'xlarge';

function isPhotocardSize(size: string | null): size is PhotocardSize {
  return size === 'little' || size === 'medium' || size === 'large' || size === 'xlarge';
}

function isRating(rating: number): rating is CollectionItem['rating'] {
  return Number.isInteger(rating) && rating >= 0 && rating <= 5;
}

function isQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1;
}

function isBooleanInteger(value: number): value is 0 | 1 {
  return value === 0 || value === 1;
}

function toCategoryValue(row: CollectionItemCategoryRow): CategoryValue {
  return { id: row.categoryId, value: row.value };
}

function createCategoryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

export class CategoryNameConflictError extends Error {
  constructor(category: 'group' | 'member') {
    super(`A ${category} with this name already exists.`);
    this.name = 'CategoryNameConflictError';
  }
}

export async function getGroups(db: SQLiteDatabase): Promise<GroupCategory[]> {
  return db.getAllAsync<GroupCategory>(
    'SELECT id, name FROM groups ORDER BY name COLLATE NOCASE, id'
  );
}

export async function getMembers(
  db: SQLiteDatabase,
  groupId?: string
): Promise<MemberCategory[]> {
  if (groupId) {
    return db.getAllAsync<MemberCategory>(
      `SELECT id, group_id AS groupId, name
       FROM members
       WHERE group_id = ?
       ORDER BY name COLLATE NOCASE, id`,
      groupId
    );
  }

  return db.getAllAsync<MemberCategory>(
    `SELECT id, group_id AS groupId, name
     FROM members
     ORDER BY name COLLATE NOCASE, id`
  );
}

export async function createGroup(db: SQLiteDatabase, name: string): Promise<string> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Group name cannot be empty.');
  }

  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM groups WHERE name = ? COLLATE NOCASE',
    normalizedName
  );
  if (existing) {
    throw new CategoryNameConflictError('group');
  }

  const id = createCategoryId();
  await db.runAsync('INSERT INTO groups (id, name) VALUES (?, ?)', id, normalizedName);
  return id;
}

export async function updateGroup(
  db: SQLiteDatabase,
  id: string,
  name: string
): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Group name cannot be empty.');
  }

  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM groups WHERE name = ? COLLATE NOCASE AND id != ?',
    normalizedName,
    id
  );
  if (existing) {
    throw new CategoryNameConflictError('group');
  }

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync('UPDATE groups SET name = ? WHERE id = ?', normalizedName, id);
    if (result.changes === 0) {
      throw new Error(`Group "${id}" no longer exists.`);
    }
    await db.runAsync(
      `UPDATE collection_item_categories
       SET value = ?
       WHERE field = 'photocardCategories.group' AND category_id = ?`,
      normalizedName,
      id
    );
  });
}

export async function deleteGroup(db: SQLiteDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const group = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM groups WHERE id = ?',
      id
    );
    if (!group) {
      throw new Error(`Group "${id}" no longer exists.`);
    }

    await db.runAsync('DELETE FROM members WHERE group_id = ?', id);
    await db.runAsync('DELETE FROM groups WHERE id = ?', id);
  });
}

export async function createMember(
  db: SQLiteDatabase,
  groupId: string,
  name: string
): Promise<string> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Member name cannot be empty.');
  }

  const group = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM groups WHERE id = ?',
    groupId
  );
  if (!group) {
    throw new Error(`Group "${groupId}" no longer exists.`);
  }

  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM members WHERE group_id = ? AND name = ? COLLATE NOCASE',
    groupId,
    normalizedName
  );
  if (existing) {
    throw new CategoryNameConflictError('member');
  }

  const id = createCategoryId();
  await db.runAsync(
    'INSERT INTO members (id, group_id, name) VALUES (?, ?, ?)',
    id,
    groupId,
    normalizedName
  );
  return id;
}

export async function updateMember(
  db: SQLiteDatabase,
  id: string,
  name: string
): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Member name cannot be empty.');
  }

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM members
     WHERE group_id = (SELECT group_id FROM members WHERE id = ?)
       AND name = ? COLLATE NOCASE
       AND id != ?`,
    id,
    normalizedName,
    id
  );
  if (existing) {
    throw new CategoryNameConflictError('member');
  }

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync('UPDATE members SET name = ? WHERE id = ?', normalizedName, id);
    if (result.changes === 0) {
      throw new Error(`Member "${id}" no longer exists.`);
    }
    await db.runAsync(
      `UPDATE collection_item_categories
       SET value = ?
       WHERE field = 'photocardCategories.member' AND category_id = ?`,
      normalizedName,
      id
    );
  });
}

export async function deleteMember(db: SQLiteDatabase, id: string): Promise<void> {
  const result = await db.runAsync('DELETE FROM members WHERE id = ?', id);
  if (result.changes === 0) {
    throw new Error(`Member "${id}" no longer exists.`);
  }
}

export async function getAllCollectionItems(
  db: SQLiteDatabase
): Promise<Collectible[]> {
  const rows = await db.getAllAsync<CollectionItemRow>(`
    SELECT
      id,
      type,
      image_uri AS imageUri,
      created_at AS createdAt,
      updated_at AS updatedAt,
      favorite,
      owned,
      wanted,
      is_catalogued AS isCatalogued,
      quantity,
      rating,
      notes,
      size,
      event_date AS eventDate
    FROM collection_items
    ORDER BY created_at DESC, id
  `);
  const categoryRows = await db.getAllAsync<CollectionItemCategoryRow>(`
    SELECT
      collection_item_id AS collectionItemId,
      field,
      category_id AS categoryId,
      value,
      position
    FROM collection_item_categories
    ORDER BY position
  `);

  const categoriesByItem = new Map<string, Map<string, CategoryValue[]>>();
  for (const row of categoryRows) {
    let categoriesByField = categoriesByItem.get(row.collectionItemId);
    if (!categoriesByField) {
      categoriesByField = new Map<string, CategoryValue[]>();
      categoriesByItem.set(row.collectionItemId, categoriesByField);
    }

    const values = categoriesByField.get(row.field) ?? [];
    values.push(toCategoryValue(row));
    categoriesByField.set(row.field, values);
  }

  return rows.map((row): Collectible => {
    if (
      !isBooleanInteger(row.favorite) ||
      !isBooleanInteger(row.owned) ||
      !isBooleanInteger(row.wanted) ||
      !isBooleanInteger(row.isCatalogued) ||
      !isQuantity(row.quantity) ||
      !isRating(row.rating)
    ) {
      throw new Error(`Collection item "${row.id}" contains invalid stored values.`);
    }

    const categories = categoriesByItem.get(row.id);
    const category = (field: string) => categories?.get(field)?.[0];
    const collectionItem: CollectionItem = {
      id: row.id,
      imageUri: row.imageUri,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      favorite: row.favorite === 1,
      owned: row.owned === 1,
      wanted: row.wanted === 1,
      isCatalogued: row.isCatalogued === 1,
      quantity: row.quantity,
      rating: row.rating,
      ...(row.notes === null ? {} : { notes: row.notes }),
      ...(category('itemEvent') ? { itemEvent: category('itemEvent') } : {}),
      ...(category('acquisitionEvent')
        ? { acquisitionEvent: category('acquisitionEvent') }
        : {}),
      customCategories: categories?.get('customCategories') ?? [],
    };

    switch (row.type) {
      case 'photocard': {
        if (!isPhotocardSize(row.size)) {
          throw new Error(`Photocard "${row.id}" has an invalid stored size.`);
        }

        return {
          ...collectionItem,
          type: 'photocard',
          size: row.size,
          photocardCategories: {
            ...(category('photocardCategories.group')
              ? { group: category('photocardCategories.group') }
              : {}),
            ...(category('photocardCategories.member')
              ? { member: category('photocardCategories.member') }
              : {}),
            ...(category('photocardCategories.album')
              ? { album: category('photocardCategories.album') }
              : {}),
            ...(category('photocardCategories.version')
              ? { version: category('photocardCategories.version') }
              : {}),
            ...(category('photocardCategories.era')
              ? { era: category('photocardCategories.era') }
              : {}),
          },
        };
      }
      case 'plushie':
        return {
          ...collectionItem,
          type: 'plushie',
          plushieCategories: {
            ...(category('plushieCategories.character')
              ? { character: category('plushieCategories.character') }
              : {}),
            ...(category('plushieCategories.edition')
              ? { edition: category('plushieCategories.edition') }
              : {}),
          },
        };
      case 'ticket':
        return {
          ...collectionItem,
          type: 'ticket',
          ticketCategories: {
            ...(category('ticketCategories.venue')
              ? { venue: category('ticketCategories.venue') }
              : {}),
            ...(category('ticketCategories.city')
              ? { city: category('ticketCategories.city') }
              : {}),
          },
          ...(row.eventDate === null ? {} : { eventDate: row.eventDate }),
        };
      case 'albumInclusion':
        return { ...collectionItem, type: 'albumInclusion' };
      case 'other':
        return { ...collectionItem, type: 'other' };
      default:
        throw new Error(`Collection item "${row.id}" has an unknown type.`);
    }
  });
}

export async function getPhotocardEmbeddings(
  db: SQLiteDatabase,
  modelVersion: string
): Promise<PhotocardEmbedding[]> {
  const rows = await db.getAllAsync<{
    collectionItemId: string;
    modelVersion: string;
    vectorJson: string;
  }>(
    `SELECT
       embedding.collection_item_id AS collectionItemId,
       embedding.model_version AS modelVersion,
       embedding.vector_json AS vectorJson
     FROM photocard_embeddings AS embedding
     INNER JOIN collection_items AS item ON item.id = embedding.collection_item_id
     WHERE item.type = 'photocard' AND embedding.model_version = ?
     ORDER BY item.created_at DESC, item.id`,
    modelVersion
  );

  return rows.map((row) => {
    let vector: unknown;
    try {
      vector = JSON.parse(row.vectorJson);
    } catch (error) {
      throw new Error(
        `Stored embedding for photocard "${row.collectionItemId}" is invalid JSON.`,
        { cause: error }
      );
    }

    if (
      !Array.isArray(vector) ||
      vector.length === 0 ||
      !vector.every((value): value is number => Number.isFinite(value))
    ) {
      throw new Error(`Stored embedding for photocard "${row.collectionItemId}" is invalid.`);
    }

    return {
      collectionItemId: row.collectionItemId,
      modelVersion: row.modelVersion,
      vector,
    };
  });
}

export async function savePhotocardEmbedding(
  db: SQLiteDatabase,
  collectionItemId: string,
  modelVersion: string,
  vector: number[]
): Promise<void> {
  if (!modelVersion.trim() || vector.length === 0 || !vector.every(Number.isFinite)) {
    throw new Error('Cannot save an invalid photocard embedding.');
  }

  const item = await db.getFirstAsync<{ type: string }>(
    'SELECT type FROM collection_items WHERE id = ?',
    collectionItemId
  );
  if (item?.type !== 'photocard') {
    throw new Error(`Collection item "${collectionItemId}" is not a photocard.`);
  }

  await db.runAsync(
    `INSERT INTO photocard_embeddings (
       collection_item_id,
       model_version,
       vector_json,
       created_at
     ) VALUES (?, ?, ?, ?)
     ON CONFLICT(collection_item_id) DO UPDATE SET
       model_version = excluded.model_version,
       vector_json = excluded.vector_json,
       created_at = excluded.created_at`,
    collectionItemId,
    modelVersion,
    JSON.stringify(vector),
    new Date().toISOString()
  );
}

export async function clearAllCollectionItems(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM collection_item_categories;
      DELETE FROM collection_items;
    `);
  });
}

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);

  const version = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = version?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${DATABASE_VERSION}.`
    );
  }

  if (currentVersion === DATABASE_VERSION) {
    return;
  }

  await db.withTransactionAsync(async () => {
    if (currentVersion === 0) {
      await db.execAsync(`
        CREATE TABLE collection_items (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK (
            type IN ('photocard', 'plushie', 'ticket', 'albumInclusion', 'other')
          ),
          image_uri TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          favorite INTEGER NOT NULL CHECK (favorite IN (0, 1)),
          owned INTEGER NOT NULL CHECK (owned IN (0, 1)),
          wanted INTEGER NOT NULL CHECK (wanted IN (0, 1)),
          is_catalogued INTEGER NOT NULL DEFAULT 0 CHECK (is_catalogued IN (0, 1)),
          quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
          rating INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 5),
          notes TEXT,
          size TEXT CHECK (size IN ('little', 'medium', 'large', 'xlarge') OR size IS NULL),
          event_date TEXT,
          CHECK (
            (type = 'photocard' AND size IS NOT NULL)
            OR (type != 'photocard' AND size IS NULL)
          ),
          CHECK (event_date IS NULL OR type = 'ticket')
        );

        CREATE TABLE collection_item_categories (
          collection_item_id TEXT NOT NULL
            REFERENCES collection_items(id) ON DELETE CASCADE,
          field TEXT NOT NULL CHECK (
            field IN (
              'itemEvent',
              'acquisitionEvent',
              'customCategories',
              'photocardCategories.group',
              'photocardCategories.member',
              'photocardCategories.album',
              'photocardCategories.version',
              'photocardCategories.era',
              'plushieCategories.character',
              'plushieCategories.edition',
              'ticketCategories.venue',
              'ticketCategories.city'
            )
          ),
          category_id TEXT NOT NULL,
          value TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
          CHECK (field = 'customCategories' OR position = 0),
          PRIMARY KEY (collection_item_id, field, position)
        );
      `);
    }

    if (currentVersion < 2) {
      const columns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(collection_items)'
      );
      if (!columns.some((column) => column.name === 'quantity')) {
        await db.execAsync(`
          ALTER TABLE collection_items
          ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1);
        `);
      }
    }

    if (currentVersion < 3) {
      const columns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(collection_items)'
      );
      if (!columns.some((column) => column.name === 'is_catalogued')) {
        await db.execAsync(`
          ALTER TABLE collection_items
          ADD COLUMN is_catalogued INTEGER NOT NULL DEFAULT 0 CHECK (is_catalogued IN (0, 1));
        `);
      }
    }

    if (currentVersion < 4) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
    }

    if (currentVersion < 5) {
      await db.execAsync(`
        CREATE TABLE groups (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE
        );

        CREATE TABLE members (
          id TEXT PRIMARY KEY NOT NULL,
          group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          name TEXT NOT NULL COLLATE NOCASE,
          UNIQUE (group_id, name)
        );
      `);

      const oldGroups = await db.getAllAsync<{
        collectionItemId: string;
        value: string;
      }>(`
        SELECT collection_item_id AS collectionItemId, value
        FROM collection_item_categories
        WHERE field = 'photocardCategories.group'
        ORDER BY value COLLATE NOCASE
      `);
      const groupByName = new Map<string, GroupCategory>();
      const groupIdByItem = new Map<string, string>();
      for (const oldGroup of oldGroups) {
        const name = oldGroup.value.trim();
        if (!name) {
          continue;
        }

        const normalizedName = normalizeCategoryName(name);
        let group = groupByName.get(normalizedName);
        if (!group) {
          group = { id: createCategoryId(), name };
          await db.runAsync('INSERT INTO groups (id, name) VALUES (?, ?)', group.id, group.name);
          groupByName.set(normalizedName, group);
        }

        groupIdByItem.set(oldGroup.collectionItemId, group.id);
        await db.runAsync(
          `UPDATE collection_item_categories
           SET category_id = ?, value = ?
           WHERE collection_item_id = ? AND field = 'photocardCategories.group'`,
          group.id,
          group.name,
          oldGroup.collectionItemId
        );
      }

      const oldMembers = await db.getAllAsync<{
        collectionItemId: string;
        value: string;
      }>(`
        SELECT member.collection_item_id AS collectionItemId, member.value
        FROM collection_item_categories AS member
        WHERE member.field = 'photocardCategories.member'
        ORDER BY member.value COLLATE NOCASE
      `);
      const memberByGroupAndName = new Map<string, MemberCategory>();
      for (const oldMember of oldMembers) {
        const groupId = groupIdByItem.get(oldMember.collectionItemId);
        const name = oldMember.value.trim();
        if (!groupId || !name) {
          continue;
        }

        const key = `${groupId}:${normalizeCategoryName(name)}`;
        let member = memberByGroupAndName.get(key);
        if (!member) {
          member = { id: createCategoryId(), groupId, name };
          await db.runAsync(
            'INSERT INTO members (id, group_id, name) VALUES (?, ?, ?)',
            member.id,
            groupId,
            member.name
          );
          memberByGroupAndName.set(key, member);
        }

        await db.runAsync(
          `UPDATE collection_item_categories
           SET category_id = ?, value = ?
           WHERE collection_item_id = ? AND field = 'photocardCategories.member'`,
          member.id,
          member.name,
          oldMember.collectionItemId
        );
      }
    }

    if (currentVersion < 6) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS photocard_embeddings (
          collection_item_id TEXT PRIMARY KEY NOT NULL
            REFERENCES collection_items(id) ON DELETE CASCADE,
          model_version TEXT NOT NULL,
          vector_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    }

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}

export async function savePhotocardFromImage(
  db: SQLiteDatabase,
  imageUri: string,
  catalog: PhotocardCatalogInput | null = null
): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const itemId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let isFirstCollectionItem = false;

  await db.withTransactionAsync(async () => {
    const countBefore = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM collection_items'
    );
    const messageState = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_metadata WHERE key = 'first_collection_item_message_shown'`
    );

    await db.runAsync(
      `INSERT INTO collection_items (
        id,
        type,
        image_uri,
        created_at,
        updated_at,
        favorite,
        owned,
        wanted,
        is_catalogued,
        quantity,
        rating,
        notes,
        size
      ) VALUES (?, 'photocard', ?, ?, ?, ?, 1, ?, 0, 1, ?, ?, 'medium')`,
      itemId,
      imageUri,
      timestamp,
      timestamp,
      catalog?.favorite ? 1 : 0,
      catalog?.wanted ? 1 : 0,
      catalog?.rating ?? 0,
      catalog?.notes.trim() || null
    );

    if (catalog) {
      if (catalog.member && !catalog.group) {
        throw new Error('A member cannot be saved without its group.');
      }
      if (catalog.group) {
        const group = await db.getFirstAsync<{ name: string }>(
          'SELECT name FROM groups WHERE id = ?',
          catalog.group.id
        );
        if (!group) {
          throw new Error(`Group "${catalog.group.id}" no longer exists.`);
        }
      }
      if (catalog.member && catalog.group) {
        const member = await db.getFirstAsync<{ name: string; groupId: string }>(
          'SELECT name, group_id AS groupId FROM members WHERE id = ?',
          catalog.member.id
        );
        if (!member || member.groupId !== catalog.group.id) {
          throw new Error(`Member "${catalog.member.id}" does not belong to the selected group.`);
        }
      }

      const categories: Array<[string, CategoryValue | null, number]> = [
        ['photocardCategories.group', catalog.group, 0],
        ['photocardCategories.member', catalog.member, 0],
        ['photocardCategories.album', catalog.album ? { id: createCategoryId(), value: catalog.album } : null, 0],
        ['photocardCategories.version', catalog.version ? { id: createCategoryId(), value: catalog.version } : null, 0],
        ['photocardCategories.era', catalog.era ? { id: createCategoryId(), value: catalog.era } : null, 0],
        ['itemEvent', catalog.itemEvent ? { id: createCategoryId(), value: catalog.itemEvent } : null, 0],
        ['acquisitionEvent', catalog.acquisitionEvent ? { id: createCategoryId(), value: catalog.acquisitionEvent } : null, 0],
        ...catalog.customCategories.map(
          (value, position) =>
            ['customCategories', { id: createCategoryId(), value }, position] as [
              string,
              CategoryValue,
              number,
            ]
        ),
      ];

      for (const [field, category, position] of categories) {
        if (!category || !category.value.trim()) {
          continue;
        }

        const normalizedValue = category.value.trim();
        await db.runAsync(
          `INSERT INTO collection_item_categories (
            collection_item_id, field, category_id, value, position
          ) VALUES (?, ?, ?, ?, ?)`,
          itemId,
          field,
          category.id,
          normalizedValue,
          position
        );
      }
    }

    const countAfter = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM collection_items'
    );
    isFirstCollectionItem =
      countBefore?.count === 0 &&
      countAfter?.count === 1 &&
      messageState?.value !== 'true';

    if (isFirstCollectionItem) {
      await db.runAsync(
        `INSERT INTO app_metadata (key, value)
         VALUES ('first_collection_item_message_shown', 'true')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      );
    }
  });

  return isFirstCollectionItem;
}
