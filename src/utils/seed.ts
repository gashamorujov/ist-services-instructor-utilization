import type { Course, Teacher } from '../types'

// Teachers extracted from "insert month" sheet (rows 10-22, real list).
export const INITIAL_TEACHERS: Teacher[] = [
  'Rəhimov Ehtiram Bəşir oğlu',
  'Bayramov Azad Adil oğlu (ŞTAT)',
  'Musayev Sərvər Musa oğlu',
  'Ələkbərov Xalıq Abdulhüseyn oğlu',
  'İsgəndərov Ələsgər Avdil oğlu',
  'Əkbərov Zahir',
  'Ağalar Qafar',
  'Məhəmməd Qurbanov',
  'Zabil Əliyev',
  'Rahab Tahirov',
  'Nizami Alməmmədov',
  'Əhmədov Qasım',
  'Hacıyev İlham',
].map((name, i) => ({ id: `t_${i + 1}`, fullName: name, order: i + 1, active: true }))

type SeedInput = [string, string, number]

const RAW_COURSES: SeedInput[] = [
  ['SP', 'Əmniyyətli İdarəetmə haqqında Beynəlxalq Məcəllə', 16],
  ['SI', 'Gəminin Mühafizəsi üzrə ümumi hazırlıq və təlimat', 8],
  ['SH', 'Gəminin Mühafizəsi üzrə müəyyən edilmiş vəzifələrə malik şəxslərin hazırlığı', 16],
  ['SG', 'Gəmi mühafizəsi üzrə məsul Şəxs', 18],
  ['SO', 'Bütün dənizçilər üçün təhlükəsizlik üzrə tanışlıq və təlimat', 80],
  ['SW', 'Kapitan Körpüsü Resurslarının İdarə Olunması', 42],
  ['SV', 'Gəminin İdarə Olunması və Manevr Edilməsi', 40],
  ['SQ', 'Radar, ARPA, körpü komandası və axtarış-xilasetmə (idarəetmə)', 40],
  ['SR', 'Radar müşahidəsi və ARPA-nın istismarı (operativ səviyyə)', 98],
  ['SZ', 'Elektron Xəritə Displeyi və İnformasiya Sistemləri (ECDIS)', 40],
  ['SF', 'Sərnişinlərin, yükün və gövdənin təhlükəsizliyi (Ro-Ro)', 18],
  ['SD', 'Sərnişinlərə xidmət göstərən heyət üçün təhlükəsizlik', 8],
  ['SC', 'İzdihamın idarə olunması üzrə hazırlıq', 11],
  ['SE', 'Böhran zamanı idarəetmə və insan davranışı üzrə hazırlıq', 16],
  ['ST', 'Gəmi qaz analizatorları və onların istismarı', 8],
  ['SX', 'İnert qaz sistemi', 16],
  ['SN', 'Gəmidə ilk tibbi yardım', 34],
  ['SM', 'Gəmidə tibbi nəzarət', 47],
  ['DQ', 'Qlobal Dəniz Fəlakət və Əmniyyətli Rabitə Sisteminin Operatoru', 110],
  ['SA', 'Neft və kimyəvi tanker əməliyyatları üzrə ilkin hazırlıq', 48],
  ['SB', 'Neft tankerlərdə geniş proqram üzrə hazırlıq', 55],
  ['AS', 'Kimyəvi tanker əməliyyatları üzrə geniş proqram', 60],
  ['SK', 'Təhlükəli və zərərli yüklərin daşınması', 34],
  ['ER', 'Maşın şöbəsinin resurslarının idarə olunması', 37],
  ['DL', 'Liderlik və birgə iş fəaliyyəti', 20],
  ['SJ', 'Yanğınla mübarizə geniş proqram üzrə', 32],
  ['SL', 'Sürətli olmayan xilasedici qayıq üzrə mütəxəssis', 32],
  ['SU', 'Sürətli xilasetmə qayıqları üzrə mütəxəssis', 20],
]

export const INITIAL_COURSES: Course[] = RAW_COURSES.map(([code, name, hours], i) => ({
  id: `c_${i + 1}`,
  code,
  name,
  hours,
  durationDays: Math.ceil(hours / 8),
  price: undefined,
  specialRule: null,
  active: true,
}))

export const INITIAL_ROOMS = ['1/1', '1/2', '1/3', '2/1', '2/2']
