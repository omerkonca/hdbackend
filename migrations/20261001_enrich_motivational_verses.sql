-- Migration to enrich motivational_verses with additional short verses, relieving hadiths, sufi pearls and reflection quotes
-- Date: 2026-10-01

INSERT INTO public.motivational_verses (text, surah)
SELECT text, surah FROM (
    VALUES
    -- User Requested Short Verses (Widget Sized)
    ('Allah, kuluna kâfi değil midir?', 'Zümer Suresi • 36. Âyet'),
    ('Rabbin için sabret.', 'Müddessir Suresi • 7. Âyet'),
    ('O, her an yeni bir ilahî tasarruftadır.', 'Rahmân Suresi • 29. Âyet'),
    ('Senin Rabbin hiçbir şeyi unutacak değildir.', 'Meryem Suresi • 64. Âyet'),
    ('Biz, insana şah damarından daha yakınız.', 'Kâf Suresi • 16. Âyet'),
    ('Allah, göğüslerin özünü (kalplerde olanı) hakkıyla bilendir.', 'Tegâbün Suresi • 4. Âyet'),

    -- User Requested Ferahlatan Hadis-i Şerifler
    ('Müminin durumu ne ilginçtir! Her hâli kendisi için bir hayırdır.', 'Hadis-i Şerif (Müslim, Zühd 64)'),
    ('Dua, inen ve henüz inmeyen her belaya karşı fayda verir.', 'Hadis-i Şerif (Tirmizî, Deavât 101)'),
    ('Amellerin en faziletlisi, bir müminin kalbine sevinç koymaktır.', 'Hadis-i Şerif (İbn Mâce, Sünnet 16)'),
    ('Sabır, felaketle ilk karşılaşılan andadır.', 'Hadis-i Şerif (Buhârî, Cenâiz 32)'),

    -- User Requested Tasavvuf ve Gönül Ehlinin İncileri
    ('Her şey vaktini bekler. Ne gül vaktinden önce açar, ne güneş vaktinden erken doğar. Bekle, senin olan sana gelecektir.', 'Gönül İncisi (Hz. Mevlânâ)'),
    ('Görelim Mevla ne eyler, ne eylerse güzel eyler.', 'Hikmetli Söz (Erzurumlu İbrahim Hakkı)'),
    ('Kader gayrete aşıktır.', 'Gönül İncisi (Yunus Emre)'),
    ('Nasibinde varsa alırsın karıncadan bile ders. Nasibinde yoksa bütün cihan önüne serilse sana ters.', 'Gönül İncisi (Hz. Mevlânâ)'),
    ('Derdimi seviyorum. Biliyorum ki derdimi veren de beni seviyor. Seven, sevdiğinin nazını ölçüyor.', 'Gönül İncisi (Hz. Mevlânâ)'),
    ('Ey can; kimseyi kırma. Sözden ağırı yoktur, beden çok yükü kaldırır ama gönül her sözü kaldıramaz.', 'Gönül İncisi (Hz. Mevlânâ)'),
    ('Küfrün karanlığında dahi olsan, ümit kesme! Zira en koyu karanlık, şafağın en yakın olduğu andır.', 'Gönül İncisi (Şems-i Tebrizi)'),

    -- User Requested Tevekkül ve Sabır Temalı Anonim / Derleme Sözler
    ('Bazen ''hayırlısı'' demek, en büyük duadır.', 'Hikmet & Tevekkül'),
    ('Bir kapıyı kapatan Allah, bin kapıyı açar. Sen yeter ki o eşikte sabırla beklemeyi bil.', 'Hikmet & Umut'),
    ('Senin için yazılmış olan, senden başkasına gitmez. Kalbini ferah tut.', 'Hikmet & Tevekkül'),
    ('Düştüğünde kalkmanı sağlayan şey, Allah''a olan inancındır. O inancı kaybetme.', 'Hikmet & İman'),
    ('Nasip; çok güzel bir ihtimaldir. Allah ne yazdıysa, o olur.', 'Hikmet & Tevekkül'),
    ('Rüzgar ne kadar sert eserse essin, kayadan alıp götüreceği sadece tozdur. Sen imanını sağlam tut.', 'Hikmet & Sabır'),
    ('Hiçbir acı kalıcı değildir, yeter ki sen Allah''a sığınmayı bil.', 'Hikmet & Huzur'),

    -- Eklenen Seçkin Ayet-i Kerimeler (Kısa & İlham Verici)
    ('De ki: Allah bize yeter, O ne güzel vekildir.', 'Âl-i İmrân Suresi • 173. Âyet'),
    ('Rabbin sana verecek ve sen hoşnut olacaksın.', 'Duhâ Suresi • 5. Âyet'),
    ('Kuşkusuz benim Rabbim bana çok yakındır, dualara icabet edendir.', 'Hûd Suresi • 61. Âyet'),
    ('Beni yaratan O''dur, bana doğru yolu gösteren de O''dur.', 'Şuarâ Suresi • 78. Âyet'),
    ('Korkmayın, şüphesiz ben sizinle beraberim; işitir ve görürüm.', 'Tâhâ Suresi • 46. Âyet'),
    ('Şüphesiz Allah, tevekkül edenleri sever.', 'Âl-i İmrân Suresi • 159. Âyet'),
    ('Allah sabredenleri sever.', 'Âl-i İmrân Suresi • 146. Âyet'),
    ('O, lütufkârdır, her şeyden hakkıyla haberdardır.', 'Mülk Suresi • 14. Âyet'),

    -- Eklenen Seçkin Hadis-i Şerifler
    ('Müslüman, elinden ve dilinden diğer insanların emin olduğu kimsedir.', 'Hadis-i Şerif (Buhârî, Îmân 4)'),
    ('Dua müminin silahı ve dinin direğidir.', 'Hadis-i Şerif (Hâkim, el-Müstedrek)'),
    ('İşlerin Allah''a en sevimli olanı, az da olsa devamlı olanıdır.', 'Hadis-i Şerif (Buhârî, Îmân 32)'),
    ('Allah güzeldir, güzelliği sever.', 'Hadis-i Şerif (Müslim, Îmân 147)'),

    -- Eklenen Tasavvuf İncileri
    ('Gönül Çalab’ın tahtı, Çalap gönüle baktı. İki cihan bedbahtı, kim gönül yıkar ise.', 'Gönül İncisi (Yunus Emre)'),
    ('Dünle beraber gitti cancağızım, ne kadar söz varsa düne ait. Şimdi yeni şeyler söylemek lazım.', 'Gönül İncisi (Hz. Mevlânâ)'),
    ('Gülün dikene katlanması, onu güzel kokulu yaptı.', 'Gönül İncisi (Hz. Mevlânâ)')
) AS v(text, surah)
WHERE NOT EXISTS (
    SELECT 1 FROM public.motivational_verses m 
    WHERE m.text = v.text
);
