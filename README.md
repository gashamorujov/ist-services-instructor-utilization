# IST Services — Tədris Cədvəli

Təlimatçıların aylıq dərs yükünün idarə edilməsi sistemi. React + TypeScript + Firebase Realtime Database ilə tam real-time işləyən spreadsheet/dashboard tətbiqi.

## Quraşdırma

```bash
npm install
```

## İnkişaf (Dev server)

```bash
npm run dev
```

http://localhost:5173 ünvanında açılır.

## Production build

```bash
npm run build
npm run preview
```

## Testlər

```bash
# Unit testlər
npx vitest run

# E2E testlər (Chromium ilə)
npx playwright test
```

---

## Firebase qurulumu

### 1. Realtime Database

Tətbiq Firebase Realtime Database istifadə edir. Firebase konfiqurasiyası `src/services/firebase.ts` faylında yerləşir:

```ts
const firebaseConfig = {
  apiKey: "...",
  authDomain: "sertifikatqeydiyyati.firebaseapp.com",
  databaseURL: "https://sertifikatqeydiyyati-default-rtdb.firebaseio.com",
  projectId: "sertifikatqeydiyyati",
  ...
}
```

### 2. Firebase Security Rules

İstehsalda database rules `database.rules.json` faylında hazırlanmışdır. Realtime Database konsolundan rules yüklənməlidir:

```
database.rules.json
```

Rules əsas struktur:
- `teachers`, `courses`, `months`, `rooms`, `settings` — yalnız admin tərəfindən yazılabilir
- `courseInstances`, `cells` — bütün autentifikasiya olunmuş istifadəçilər yazdıra bilər
- Oxumaq üçün autentifikasiya tələb olunur

### 3. Autentifikasiya

Tətbiq **birbaşa giriş** ilə işləyir — istifadəçi/administrator seçimi tələb olunmur, bütün səlahiyyətlər açıqdır.
Əsl Firebase Auth istifadə etmək üçün Firebase konsolunda Email/Password və ya Anonymous auth aktivləşdirilməli,
sonra `src/services/auth.ts` faylında Firebase Auth-a keçid edilməlidir.

### 4. Deploy

```bash
npm run build
firebase deploy --only hosting,database
```

---

## Excel export

İki export variantı var:

1. **Bu ayı Excel kimi yüklə** — cari ay üçün `.xlsx` fayl
2. **Bütün ayları Excel kimi yüklə** — bütün aylar üçün bir workbook, hər ay ayrı sheet

Export zamanı:
- Kurs rəngləri (Qırmızı/Yaşıl/Black) qorunur
- Otaq və Elmlər/Ramana məlumatları itirilmir
- Ödəniş cədvəli daxil edilir
- Print area, freeze panes, sütun ölçüləri avtomatik təyin olunur

---

## Layihə strukturu

```
src/
  main.tsx                         # Giriş nöqtəsi
  App.tsx                          # Layout + routing
  index.css                        # Tailwind CSS + custom styles

  types/
    index.ts                       # Data modellər (Teacher, Course, CourseInstance, etc.)

  utils/
    dates.ts                       # Tarix köməkçiləri (daysInMonth, monthName, etc.)
    seed.ts                        # İlkin seed data (Excel-dən çıxarılmış)
    calc.ts                        # Hesablama məntiqi (payments, stats, cellColor)
    id.ts                          # ID generator

  services/
    firebase.ts                    # Firebase init
    firestoreService.ts            # Firebase subscribe helper
    courseService.ts               # Re-export + applyWrites
    placement.ts                   # Kurs yerləşdirmə məntiqi (pure)
    exportService.ts               # Excel export (xlsx-js-style)
    auth.ts                        # Firebase anonymous auth probe

  store/
    DataContext.tsx                 # Əsas data layihəsi (context + providers)
    AuthContext.tsx                 # Demo login session

  pages/
    DashboardPage.tsx              # Dashboard statistikası
    SchedulePage.tsx               # Əsas spreadsheet + aylar + ödənişlər
    TeachersPage.tsx               # Müəllimlər idarəetməsi
    CoursesPage.tsx                # Kurslar idarəetməsi
    PaymentsPage.tsx               # Ödəniş hesabatları
    MonthsPage.tsx                 # Ay idarəetməsi
    SettingsPage.tsx               # Parametrlər (rənglər, otaqlar, qiymət)
    LoginPage.tsx                  # Demo giriş

  components/
    Layout.tsx                     # Sidebar + mobil drawer
    CoursePanel.tsx                # Kurs məlumat modalı
    ui.tsx                         # Shared UI (Button, Modal, Badge, Field, etc.)

  __tests__/
    placement.test.ts              # Kurs yerləşdirmə testləri
    dates.test.ts                  # Tarix testləri
    export.test.ts                 # Export testləri

database.rules.json                # Firebase Security Rules
e2e.spec.ts                        # Playwright E2E testləri
```

---

## Firebase data strukturu

```
teachers/{teacherId}             → { id, fullName, order, active }
courses/{courseId}               → { id, code, name, hours, durationDays, price, specialRule, active }
months/{YYYY-MM}                → { id, year, month, name, createdAt }
rooms/{roomId}                  → { id, name }
settings/                       → { defaultCoursePrice, colors: { default, unpaid, paid } }
courseInstances/{instanceId}    → { id, code, monthId, teacherId, startDate, endDate,
                                   hours, durationDays, room, location,
                                   paymentStatus, price, days[] }
cells/{monthId}/{teacherId}/{day} → { value, type, courseInstanceId }
```

---

## Əsas xüsusiyyətlər

- **Birbaşa giriş**: Sayta daxil olan kimi bütün səlahiyyətlərlə (admin) işləyir, login ekranı yoxdur
- **Undo / Redo**: Yuxarıdakı "Geri"/"İrəli" düymələri və Ctrl+Z / Ctrl+Y — istənilən əməliyyatı geri qaytarır
- **Avtomatik yayılma**: Kurs kodu yazıldıqda müddəti qədər avtomatik növbəti xanalara yayılır
- **Ay arası yayılma**: Kurs ay sonunda başlayarsa növbəti ayda davam edir
- **CourseInstance**: Eyni kursun bütün xanaları eyni instance ilə bağlıdır
- **XS kursu**: Manual qiymət tələb edir
- **X qeydi**: Müəllimin həmin gün dərs keçə bilməyəcəyini göstərir
- **Otaq sistemi**: Double-click ilə təyin olunur, bütün xanalarda görünür
- **Elmlər/Ramana**: Yalnız SL/SO kursları üçün sağ klik menyusu
- **Ödəniş sistemi**: Yeni kurs əlavə edildikdə avtomatik cədvəlin altındakı "Müəllimlərin ödənişləri"
  bölməsində (aktiv/ödənilməyən) görünür; "Ödənilib" edildikdə oradan çıxıb Ödənişlər səhifəsində
  müəllimin ödənilmiş məbləğinə əlavə olunur
- **Neytral rəng**: Ödənilməmiş kurs xanaları digər xanalar kimi qara rəngdə görünür (qırmızı deyil);
  ödənilmiş kurslar yaşıl rəngdə göstərilir
- **Aylar arası keçid**: Tab başlığı ilə, "+" ilə yeni ay əlavə etmə
- **Excel export**: Rəsmi format, rənglər, sütun ölçüləri, print area
- **Realtime sync**: Eyni anda bir neçə browser açıq olanda məlumatlar sinxron işləyir
- **Mobil responsive**: Horizontal scroll, sticky sütun, long-press menyu
- **Keyboard shortcuts**: Enter, Tab, Escape, Delete, Backspace

---

## Hesablama qaydaları

| Kurs kodu | Saat | Gün (ceil(saat/8)) |
|-----------|------|---------------------|
| SH        | 16   | 2                   |
| SL        | 32   | 4                   |
| SO        | 80   | 10                  |
| SR        | 98   | 13                  |
| ...       | ...  | ...                 |

**Ödəniş**: Hər kurs (instance) = 70 AZN (standart) və ya XS üçün manual.

---

## Xəbərdarlıqlar

- Firebase Auth bu layihə config-inə aid API key düzgün deyil. Demo giriş sistemi
  istifadə olunur. Tam autentifikasiya üçün düzgün Firebase projesi lazımdır.
- Bu database (sertifikatqeydiyyati) ictimai DB-dir. İstehsalda Security Rules
  loads yüklənməlidir.
