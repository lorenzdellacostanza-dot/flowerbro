-- Catalogo iniziale di Flower Bro! con gli ID e l’ordine del frontend.

INSERT INTO products (id, name, kind, price, image_url, description, composition, delivery_time, rating, display_order) VALUES
    (7, 'Petali di Seta', 'bouquet', 48, 'assets/flower_images/petali-di-seta.webp', 'Peonie rosa e rose da giardino incontrano ranuncoli color albicocca. Una composizione morbida, pensata per un anniversario o un gesto romantico.', 'Peonie, rose e ranuncoli', NULL, NULL, 1),
    (8, 'Sole di Campo', 'bouquet', 36, 'assets/flower_images/sole-di-campo.webp', 'Girasoli dorati e margherite bianche, con solidago e steli leggeri. Un mazzo dal carattere spontaneo per un compleanno o per portare luce in casa.', 'Girasoli, margherite e solidago', NULL, NULL, 2),
    (9, 'Giardino Segreto', 'bouquet', 44, 'assets/flower_images/giardino-segreto.webp', 'Lisianthus malva, scabiose e pisello odoroso in sfumature che vanno dal lilla al bordeaux. Il verde ricadente accompagna la forma naturale del mazzo.', 'Lisianthus, scabiose e pisello odoroso', NULL, NULL, 3),
    (10, 'Alba Bianca', 'bouquet', 42, 'assets/flower_images/alba-bianca.webp', 'Rose color avorio e lisianthus bianchi tra foglie di eucalipto. Una composizione luminosa per ringraziare o per vestire una tavola.', 'Rose, lisianthus ed eucalipto', NULL, NULL, 4),
    (1, 'Rosa', 'stem', 10, 'assets/flower_images/Rose.webp', 'Petali vellutati e rosso intenso. La rosa è un classico per un anniversario, una dichiarazione o un pensiero romantico.', NULL, '1–2 giorni', 4.5, 5),
    (2, 'Tulipano', 'stem', 8, 'assets/flower_images/Tulip.webp', 'Un tulipano rosa dalle linee morbide. Sta bene da solo in un vaso sottile o insieme a fiori di altre tonalità.', NULL, NULL, 4, 6),
    (3, 'Orchidea', 'stem', 15, 'assets/flower_images/Orchid.webp', 'Petali dalla forma inconfondibile per un regalo elegante. Abbinala a fiori chiari per mettere in risalto il suo colore.', NULL, NULL, 4.8, 7),
    (4, 'Girasole', 'stem', 12, 'assets/flower_images/Sunflower.webp', 'Grandi petali gialli e un centro scuro. Un fiore luminoso da regalare per un compleanno o per rallegrare la casa.', NULL, NULL, 4.2, 8),
    (5, 'Margherita', 'stem', 6, 'assets/flower_images/daisy.webp', 'Petali bianchi intorno a un centro dorato. La margherita aggiunge leggerezza a un mazzo misto e sta bene anche da sola.', NULL, NULL, 4, 9),
    (6, 'Giglio', 'stem', 10, 'assets/flower_images/Lily.webp', 'Una corolla ampia e una silhouette slanciata. Scegli il giglio per una composizione elegante o come fiore protagonista in un vaso alto.', NULL, NULL, 4.5, 10),
    (11, 'Peonia', 'stem', 12, 'assets/flower_images/peonia.webp', 'Petali rosa a strati e una corolla che si apre lentamente. Basta uno stelo per dare volume a un vaso piccolo.', NULL, NULL, NULL, 11),
    (12, 'Ranuncolo', 'stem', 7, 'assets/flower_images/ranuncolo.webp', 'Petali fitti e concentrici in tonalità albicocca. Il ranuncolo si abbina bene alle rose o a pochi steli di verde.', NULL, NULL, NULL, 12);

SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));

INSERT INTO product_origins (product_id, origin) VALUES
    (1, 'Italia'),
    (2, 'Paesi Bassi'),
    (3, 'Thailandia'),
    (4, 'Stati Uniti'),
    (5, 'Germania'),
    (6, 'Giappone');

INSERT INTO tags (code, label) VALUES
    ('romantic', 'Romantico'),
    ('classic', 'Classico'),
    ('spring', 'Primaverile'),
    ('colorful', 'Colorato'),
    ('exotic', 'Esotico'),
    ('elegant', 'Elegante'),
    ('bright', 'Luminoso'),
    ('cheerful', 'Allegro'),
    ('simple', 'Semplice'),
    ('pure', 'Delicato'),
    ('fragrant', 'Profumato');

INSERT INTO product_tags (product_id, tag_code) VALUES
    (7, 'romantic'),
    (7, 'elegant'),
    (8, 'bright'),
    (8, 'colorful'),
    (8, 'cheerful'),
    (9, 'colorful'),
    (9, 'elegant'),
    (10, 'classic'),
    (10, 'elegant'),
    (10, 'pure'),
    (1, 'romantic'),
    (1, 'classic'),
    (2, 'spring'),
    (2, 'colorful'),
    (3, 'exotic'),
    (3, 'elegant'),
    (4, 'bright'),
    (4, 'cheerful'),
    (5, 'simple'),
    (5, 'pure'),
    (6, 'elegant'),
    (6, 'fragrant'),
    (11, 'romantic'),
    (11, 'spring'),
    (11, 'elegant'),
    (12, 'spring'),
    (12, 'bright'),
    (12, 'colorful');

INSERT INTO occasions (code, label, description, image_url) VALUES
    ('anniversario', 'Anniversario', 'Rose e peonie per un gesto romantico.', 'assets/flower_images/Rose.webp'),
    ('compleanno', 'Compleanno', 'Toni solari per festeggiare.', 'assets/flower_images/Sunflower.webp'),
    ('ringraziamento', 'Ringraziamento', 'Fiori eleganti per dire grazie.', 'assets/flower_images/Lily.webp');

INSERT INTO occasion_tags (occasion_code, tag_code) VALUES
    ('anniversario', 'romantic'),
    ('compleanno', 'colorful'),
    ('compleanno', 'bright'),
    ('ringraziamento', 'elegant');
