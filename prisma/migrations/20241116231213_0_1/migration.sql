-- CreateTable
CREATE TABLE "Users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT
);

-- CreateTable
CREATE TABLE "Components" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "component_photo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "documentation_name" TEXT NOT NULL,
    "subtype_id" INTEGER NOT NULL,
    CONSTRAINT "Components_subtype_id_fkey" FOREIGN KEY ("subtype_id") REFERENCES "ComponentSubtype" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FavoriteComponents" (
    "user_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,

    PRIMARY KEY ("user_id", "component_id"),
    CONSTRAINT "FavoriteComponents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FavoriteComponents_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "Components" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentProperties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_name" TEXT NOT NULL,
    "property_value" TEXT NOT NULL,
    "component_id" INTEGER NOT NULL,
    CONSTRAINT "ComponentProperties_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "Components" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentSubtype" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subtype_name" TEXT NOT NULL,
    "type_id" INTEGER,
    CONSTRAINT "ComponentSubtype_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "ComponentType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_name" TEXT NOT NULL,
    "type_description" TEXT NOT NULL,
    "type_image" TEXT NOT NULL
);
