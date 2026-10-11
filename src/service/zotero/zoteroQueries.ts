/**
 * SQL queries for Zotero and Better BibTeX databases
 */

// Query for Better BibTeX citation keys
export const queryBbt = `
    SELECT
        itemKey as zoteroKey,
        citationKey as citeKey
    FROM
        citationkey
`;

// Query for Zotero items (extended to include abstract, publicationTitle, DOI, timestamps, and BibTeX fields)
export const queryItems = `
    SELECT DISTINCT
        items.key as zoteroKey,
        fields.fieldName,
        parentItemDataValues.value,
        itemTypes.typeName,
        items.libraryID,
        items.dateAdded,
        items.dateModified
    FROM
        items
        INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
        INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
        INNER JOIN fields ON fields.fieldID = parentItemData.fieldID
        INNER JOIN itemTypes ON itemTypes.itemTypeID = items.itemTypeID
    WHERE
        fields.fieldName IN ('title', 'date', 'abstractNote', 'publicationTitle', 'bookTitle', 'proceedingsTitle', 'DOI', 'volume', 'issue', 'pages', 'publisher', 'place', 'url', 'ISBN', 'ISSN', 'citationKey');
`;

// Query for item tags
export const queryTags = `
    SELECT
        items.key as zoteroKey,
        tags.name as tagName
    FROM
        items
        INNER JOIN itemTags ON itemTags.itemID = items.itemID
        INNER JOIN tags ON tags.tagID = itemTags.tagID
`;

// Query for item collections
export const queryCollections = `
    SELECT
        items.key as zoteroKey,
        collections.collectionName
    FROM
        items
        INNER JOIN collectionItems ON collectionItems.itemID = items.itemID
        INNER JOIN collections ON collections.collectionID = collectionItems.collectionID
`;

// Query for creators
export const queryCreators = `
    SELECT DISTINCT
        items.key as zoteroKey,
        creators.firstName,
        creators.lastName,
        itemCreators.orderIndex,
        creatorTypes.creatorType
    FROM
        items
        INNER JOIN itemData ON itemData.itemID = items.itemID
        INNER JOIN itemCreators ON itemCreators.itemID = items.itemID
        INNER JOIN creators ON creators.creatorID = itemCreators.creatorID
        INNER JOIN creatorTypes ON itemCreators.creatorTypeID = creatorTypes.creatorTypeID
`;

// Query for libraries (to determine personal vs group)
export const queryLibraries = `
    SELECT
        libraryID,
        type,
        editable,
        filesEditable
    FROM
        libraries
`;
