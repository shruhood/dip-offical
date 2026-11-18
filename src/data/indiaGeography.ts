export type IndiaLocationLevel = 'country' | 'state' | 'ut' | 'district' | 'city' | 'town';

export type IndiaRegionZone =
  | 'North India'
  | 'West India'
  | 'South India'
  | 'East India'
  | 'Central India'
  | 'Northeast India'
  | 'Island Territories';

export interface IndiaLocationRecord {
  id: string;
  slug: string;
  parentId: string | null;
  level: IndiaLocationLevel;
  stateSlug: string;
  districtSlug?: string;
  citySlug?: string;
  canonicalPath: string;
  name: string;
  nativeNames: Partial<Record<string, string>>;
  lgdCode: string;
  censusCode?: string;
  isoCode?: string;
  capital?: string;
  pinCodes: string;
  latitude: number;
  longitude: number;
  officialLanguages: string[];
  regionZone: IndiaRegionZone;
  sourceAuthority: string;
  sourceUrl: string;
  verified: boolean;
  published: boolean;
  indexPolicy: 'auto' | 'index' | 'noindex';
  highlightedServiceSlugs: string[];
  customSummary: string;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt?: string;
}

interface CompactCitySeed {
  name: string;
  slug?: string;
  level?: 'city' | 'town';
  lgdCode: string;
  pinCodes: string;
  lat: number;
  lng: number;
  nativeNames?: Partial<Record<string, string>>;
  summary?: string;
}

interface CompactDistrictSeed {
  name: string;
  slug?: string;
  lgdCode: string;
  pinCodes: string;
  lat: number;
  lng: number;
  nativeNames?: Partial<Record<string, string>>;
  cities: CompactCitySeed[];
}

interface CompactStateSeed {
  slug: string;
  name: string;
  level: 'state' | 'ut';
  lgdCode: string;
  censusCode: string;
  isoCode: string;
  capital: string;
  pinCodes: string;
  lat: number;
  lng: number;
  regionZone: IndiaRegionZone;
  officialLanguages: string[];
  nativeNames: Partial<Record<string, string>>;
  highlightedServiceSlugs: string[];
  summary: string;
  districts: CompactDistrictSeed[];
}

function slugifyGeo(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DEFAULT_HIGHLIGHTS = [
  'pan-card',
  'gst-registration',
  'udyam-registration',
  'income-tax-return-itr-1',
  'fssai-basic-registration',
  'gazette-name-change',
];

const LGD_SOURCE_URL = 'https://lgdirectory.gov.in/';

const STATE_AND_UT_SEEDS: CompactStateSeed[] = [
  // ==========================================
  // 28 STATES
  // ==========================================
  {
    slug: 'andhra-pradesh',
    name: 'Andhra Pradesh',
    level: 'state',
    lgdCode: 'LGD-ST-28',
    censusCode: '28',
    isoCode: 'IN-AP',
    capital: 'Amaravati',
    pinCodes: '515001–535594',
    lat: 15.9129,
    lng: 79.74,
    regionZone: 'South India',
    officialLanguages: ['te', 'en', 'ur'],
    nativeNames: { hi: 'आंध्र प्रदेश', te: 'ఆంధ్రప్రదేశ్', ur: 'آندھرا پردیش' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Complete online documentation, Udyam MSME registration, GST compliance, FSSAI food licensing, and citizen certificate facilitation across all 26 districts of Andhra Pradesh.',
    districts: [
      {
        name: 'Visakhapatnam',
        lgdCode: 'LGD-DT-520',
        pinCodes: '530001–531173',
        lat: 17.6868,
        lng: 83.2185,
        nativeNames: { te: 'విశాఖపట్నం', hi: 'विशाखापत्तनम' },
        cities: [
          { name: 'Visakhapatnam', lgdCode: 'LGD-CT-802956', pinCodes: '530001', lat: 17.6868, lng: 83.2185, nativeNames: { te: 'విశాఖపట్నం' } },
          { name: 'Bheemunipatnam', level: 'town', lgdCode: 'LGD-TN-802955', pinCodes: '531163', lat: 17.8902, lng: 83.4525 },
        ],
      },
      {
        name: 'NTR',
        slug: 'ntr-vijayawada',
        lgdCode: 'LGD-DT-749',
        pinCodes: '520001–521456',
        lat: 16.5062,
        lng: 80.648,
        nativeNames: { te: 'ఎన్టీఆర్ जिल्हा' },
        cities: [
          { name: 'Vijayawada', lgdCode: 'LGD-CT-802967', pinCodes: '520001', lat: 16.5062, lng: 80.648, nativeNames: { te: 'విజయవాడ' } },
        ],
      },
      {
        name: 'Guntur',
        lgdCode: 'LGD-DT-506',
        pinCodes: '522001–522659',
        lat: 16.3067,
        lng: 80.4365,
        nativeNames: { te: 'గుంటూరు' },
        cities: [
          { name: 'Guntur', lgdCode: 'LGD-CT-802975', pinCodes: '522001', lat: 16.3067, lng: 80.4365 },
          { name: 'Amaravati', level: 'town', lgdCode: 'LGD-TN-590020', pinCodes: '522020', lat: 16.5419, lng: 80.515 },
        ],
      },
      {
        name: 'Tirupati',
        lgdCode: 'LGD-DT-752',
        pinCodes: '517501–524421',
        lat: 13.6288,
        lng: 79.4192,
        nativeNames: { te: 'తిరుపతి' },
        cities: [
          { name: 'Tirupati', lgdCode: 'LGD-CT-803013', pinCodes: '517501', lat: 13.6288, lng: 79.4192 },
        ],
      },
    ],
  },
  {
    slug: 'arunachal-pradesh',
    name: 'Arunachal Pradesh',
    level: 'state',
    lgdCode: 'LGD-ST-12',
    censusCode: '12',
    isoCode: 'IN-AR',
    capital: 'Itanagar',
    pinCodes: '790001–792131',
    lat: 27.1004,
    lng: 93.6167,
    regionZone: 'Northeast India',
    officialLanguages: ['en', 'hi', 'as'],
    nativeNames: { hi: 'अरुणाचल प्रदेश', as: 'অৰুণাচল প্ৰদেশ' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online PAN, Passport, Udyam MSME, GST, and scholarship assistance tailored for residents, entrepreneurs, and cooperatives in Arunachal Pradesh.',
    districts: [
      {
        name: 'Papum Pare',
        lgdCode: 'LGD-DT-237',
        pinCodes: '791110–791123',
        lat: 27.1456,
        lng: 93.7495,
        cities: [
          { name: 'Itanagar', lgdCode: 'LGD-CT-801428', pinCodes: '791111', lat: 27.0844, lng: 93.6053 },
          { name: 'Naharlagun', level: 'town', lgdCode: 'LGD-TN-801427', pinCodes: '791110', lat: 27.1047, lng: 93.6952 },
        ],
      },
      {
        name: 'Tawang',
        lgdCode: 'LGD-DT-241',
        pinCodes: '790104–790106',
        lat: 27.5861,
        lng: 91.8594,
        cities: [
          { name: 'Tawang', level: 'town', lgdCode: 'LGD-TN-801417', pinCodes: '790104', lat: 27.5861, lng: 91.8594 },
        ],
      },
    ],
  },
  {
    slug: 'assam',
    name: 'Assam',
    level: 'state',
    lgdCode: 'LGD-ST-18',
    censusCode: '18',
    isoCode: 'IN-AS',
    capital: 'Dispur',
    pinCodes: '781001–788931',
    lat: 26.2006,
    lng: 92.9376,
    regionZone: 'Northeast India',
    officialLanguages: ['as', 'bn', 'brx', 'en', 'hi'],
    nativeNames: { as: 'অসম', bn: 'আসাম', brx: 'आसाम', hi: 'असम' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Verified online PAN, GST, Trade Licence, FSSAI, Udyam MSME, and citizen document facilitation across Guwahati, Silchar, Dibrugarh, and every district of Assam.',
    districts: [
      {
        name: 'Kamrup Metropolitan',
        lgdCode: 'LGD-DT-618',
        pinCodes: '781001–781171',
        lat: 26.1445,
        lng: 91.7362,
        nativeNames: { as: 'কামৰূপ মহানগৰ' },
        cities: [
          { name: 'Guwahati', lgdCode: 'LGD-CT-801598', pinCodes: '781001', lat: 26.1445, lng: 91.7362, nativeNames: { as: 'গুৱাহাটী' } },
          { name: 'Dispur', level: 'town', lgdCode: 'LGD-TN-801599', pinCodes: '781006', lat: 26.1408, lng: 91.7905 },
        ],
      },
      {
        name: 'Dibrugarh',
        lgdCode: 'LGD-DT-286',
        pinCodes: '786001–786614',
        lat: 27.4728,
        lng: 94.912,
        cities: [
          { name: 'Dibrugarh', lgdCode: 'LGD-CT-801614', pinCodes: '786001', lat: 27.4728, lng: 94.912 },
        ],
      },
      {
        name: 'Cachar',
        lgdCode: 'LGD-DT-282',
        pinCodes: '788001–788832',
        lat: 24.8333,
        lng: 92.7789,
        cities: [
          { name: 'Silchar', lgdCode: 'LGD-CT-801638', pinCodes: '788001', lat: 24.8333, lng: 92.7789 },
        ],
      },
    ],
  },
  {
    slug: 'bihar',
    name: 'Bihar',
    level: 'state',
    lgdCode: 'LGD-ST-10',
    censusCode: '10',
    isoCode: 'IN-BR',
    capital: 'Patna',
    pinCodes: '800001–855117',
    lat: 25.0961,
    lng: 85.3131,
    regionZone: 'East India',
    officialLanguages: ['hi', 'mai', 'ur', 'en'],
    nativeNames: { hi: 'बिहार', mai: 'बिहार', ur: 'بہار' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Transparent PAN card, Income/Caste/Residence certificate guidance, scholarship portals, Udyam MSME, and GST services across all 38 districts of Bihar.',
    districts: [
      {
        name: 'Patna',
        lgdCode: 'LGD-DT-212',
        pinCodes: '800001–804453',
        lat: 25.5941,
        lng: 85.1376,
        nativeNames: { hi: 'पटना', mai: 'पटना' },
        cities: [
          { name: 'Patna', lgdCode: 'LGD-CT-801373', pinCodes: '800001', lat: 25.5941, lng: 85.1376, nativeNames: { hi: 'पटना' } },
          { name: 'Danapur', level: 'town', lgdCode: 'LGD-TN-801372', pinCodes: '801503', lat: 25.6368, lng: 85.0462 },
        ],
      },
      {
        name: 'Gaya',
        lgdCode: 'LGD-DT-196',
        pinCodes: '823001–824237',
        lat: 24.7914,
        lng: 85.0002,
        cities: [
          { name: 'Gaya', lgdCode: 'LGD-CT-801407', pinCodes: '823001', lat: 24.7914, lng: 85.0002 },
        ],
      },
      {
        name: 'Darbhanga',
        lgdCode: 'LGD-DT-195',
        pinCodes: '846001–847427',
        lat: 26.1542,
        lng: 85.8918,
        nativeNames: { mai: 'दरभंगा' },
        cities: [
          { name: 'Darbhanga', lgdCode: 'LGD-CT-801319', pinCodes: '846004', lat: 26.1542, lng: 85.8918 },
        ],
      },
    ],
  },
  {
    slug: 'chhattisgarh',
    name: 'Chhattisgarh',
    level: 'state',
    lgdCode: 'LGD-ST-22',
    censusCode: '22',
    isoCode: 'IN-CT',
    capital: 'Raipur',
    pinCodes: '490001–497778',
    lat: 21.2787,
    lng: 81.8661,
    regionZone: 'Central India',
    officialLanguages: ['hi', 'en'],
    nativeNames: { hi: 'छत्तीसगढ़' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Assisted online PAN, Domicile, Caste, Shop Act, GST, and Udyam MSME compliance services across Raipur, Bilaspur, Durg-Bhilai, and all Chhattisgarh districts.',
    districts: [
      {
        name: 'Raipur',
        lgdCode: 'LGD-DT-387',
        pinCodes: '492001–493996',
        lat: 21.2514,
        lng: 81.6296,
        cities: [
          { name: 'Raipur', lgdCode: 'LGD-CT-802006', pinCodes: '492001', lat: 21.2514, lng: 81.6296, nativeNames: { hi: 'रायपुर' } },
        ],
      },
      {
        name: 'Durg',
        lgdCode: 'LGD-DT-378',
        pinCodes: '490001–491445',
        lat: 21.1904,
        lng: 81.2849,
        cities: [
          { name: 'Bhilai Nagar', lgdCode: 'LGD-CT-801988', pinCodes: '490001', lat: 21.1938, lng: 81.3509 },
        ],
      },
    ],
  },
  {
    slug: 'goa',
    name: 'Goa',
    level: 'state',
    lgdCode: 'LGD-ST-30',
    censusCode: '30',
    isoCode: 'IN-GA',
    capital: 'Panaji',
    pinCodes: '403001–403806',
    lat: 15.2993,
    lng: 74.124,
    regionZone: 'West India',
    officialLanguages: ['kok', 'mr', 'en', 'hi'],
    nativeNames: { kok: 'गोंय', mr: 'गोवा', hi: 'गोवा' },
    highlightedServiceSlugs: ['fssai-state-licence', 'gst-registration', 'import-export-code-iec', 'passport-application-assistance', 'pan-card', 'trademark-registration'],
    summary:
      'Hospitality FSSAI licences, GST, Import Export Code (IEC), Passport assistance, and business compliance support across North and South Goa.',
    districts: [
      {
        name: 'North Goa',
        lgdCode: 'LGD-DT-551',
        pinCodes: '403001–403527',
        lat: 15.5439,
        lng: 73.8414,
        cities: [
          { name: 'Panaji', lgdCode: 'LGD-CT-803243', pinCodes: '403001', lat: 15.4909, lng: 73.8278, nativeNames: { kok: 'पणजी', mr: 'पणजी' } },
          { name: 'Mapusa', level: 'town', lgdCode: 'LGD-TN-803239', pinCodes: '403507', lat: 15.591, lng: 73.809 },
        ],
      },
      {
        name: 'South Goa',
        lgdCode: 'LGD-DT-552',
        pinCodes: '403601–403806',
        lat: 15.2036,
        lng: 74.0884,
        cities: [
          { name: 'Margao', lgdCode: 'LGD-CT-803253', pinCodes: '403601', lat: 15.2832, lng: 73.9862 },
          { name: 'Vasco da Gama', lgdCode: 'LGD-CT-803252', pinCodes: '403802', lat: 15.3982, lng: 73.8113 },
        ],
      },
    ],
  },
  {
    slug: 'gujarat',
    name: 'Gujarat',
    level: 'state',
    lgdCode: 'LGD-ST-24',
    censusCode: '24',
    isoCode: 'IN-GJ',
    capital: 'Gandhinagar',
    pinCodes: '360001–396590',
    lat: 22.2587,
    lng: 71.1924,
    regionZone: 'West India',
    officialLanguages: ['gu', 'hi', 'en', 'sd'],
    nativeNames: { gu: 'ગુજરાત', hi: 'गुजरात', mr: 'गुजरात' },
    highlightedServiceSlugs: [
      'gst-registration',
      'udyam-registration',
      'private-limited-company-registration',
      'pan-card',
      'fssai-state-licence',
      'income-tax-return-itr-1',
    ],
    summary:
      'Direct South Gujarat & pan-Gujarat coverage for GIDC industrial compliance, GST, Udyam MSME, ROC annual filings, payroll, PAN, ITR, and digital automation.',
    districts: [
      {
        name: 'Valsad',
        lgdCode: 'LGD-DT-459',
        pinCodes: '396001–396590',
        lat: 20.5992,
        lng: 72.9342,
        nativeNames: { gu: 'વલસાડ', hi: 'वलसाड' },
        cities: [
          {
            name: 'Vapi',
            lgdCode: 'LGD-CT-802636',
            pinCodes: '396191',
            lat: 20.3893,
            lng: 72.9106,
            nativeNames: { gu: 'વાપી', hi: 'वापी' },
            summary: 'Adjacent to our Silvassa headquarters (20 min corridor), serving Vapi GIDC industrial units with GST, ROC, PF/ESIC, and PAN/ITR compliance.',
          },
          {
            name: 'Valsad',
            lgdCode: 'LGD-CT-802632',
            pinCodes: '396001',
            lat: 20.5992,
            lng: 72.9342,
            nativeNames: { gu: 'વલસાડ', hi: 'वलसाड' },
            summary: 'Complete online ITR filing, Shop Act, Udyam MSME, student admission, and citizen documentation assistance for Valsad.',
          },
          {
            name: 'Umargam',
            level: 'town',
            lgdCode: 'LGD-TN-524148',
            pinCodes: '396171',
            lat: 20.165,
            lng: 72.748,
            nativeNames: { gu: 'ઉમરગામ', hi: 'उमरगाम' },
            summary: 'Serving Umargam GIDC and Sanjan corridor businesses with Udyam MSME, GeM seller onboarding, GST, and CSC partner support.',
          },
        ],
      },
      {
        name: 'Ahmedabad',
        lgdCode: 'LGD-DT-438',
        pinCodes: '380001–382490',
        lat: 23.0225,
        lng: 72.5714,
        nativeNames: { gu: 'અમદાવાદ', hi: 'अहमदाबाद' },
        cities: [
          { name: 'Ahmedabad', lgdCode: 'LGD-CT-802483', pinCodes: '380001', lat: 23.0225, lng: 72.5714, nativeNames: { gu: 'અમદાવાદ' } },
        ],
      },
      {
        name: 'Surat',
        lgdCode: 'LGD-DT-456',
        pinCodes: '394101–395017',
        lat: 21.1702,
        lng: 72.8311,
        nativeNames: { gu: 'સુરત', hi: 'सूरत' },
        cities: [
          { name: 'Surat', lgdCode: 'LGD-CT-802630', pinCodes: '395003', lat: 21.1702, lng: 72.8311, nativeNames: { gu: 'સુરત' } },
        ],
      },
      {
        name: 'Vadodara',
        lgdCode: 'LGD-DT-458',
        pinCodes: '390001–391780',
        lat: 22.3072,
        lng: 73.1812,
        nativeNames: { gu: 'વડોદરા' },
        cities: [
          { name: 'Vadodara', lgdCode: 'LGD-CT-802579', pinCodes: '390001', lat: 22.3072, lng: 73.1812 },
        ],
      },
    ],
  },
  {
    slug: 'haryana',
    name: 'Haryana',
    level: 'state',
    lgdCode: 'LGD-ST-06',
    censusCode: '06',
    isoCode: 'IN-HR',
    capital: 'Chandigarh',
    pinCodes: '121001–136156',
    lat: 29.0588,
    lng: 76.0856,
    regionZone: 'North India',
    officialLanguages: ['hi', 'pa', 'en'],
    nativeNames: { hi: 'हरियाणा', pa: 'ਹਰਿਆਣਾ' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Startup incorporation, Haryana MSME/GST registration, ITR filings, and citizen certificate assistance across Gurugram, Faridabad, Panipat, and all Haryana districts.',
    districts: [
      {
        name: 'Gurugram',
        lgdCode: 'LGD-DT-067',
        pinCodes: '122001–122508',
        lat: 28.4595,
        lng: 77.0266,
        nativeNames: { hi: 'गुरुग्राम' },
        cities: [
          { name: 'Gurugram', lgdCode: 'LGD-CT-800436', pinCodes: '122001', lat: 28.4595, lng: 77.0266 },
        ],
      },
      {
        name: 'Faridabad',
        lgdCode: 'LGD-DT-064',
        pinCodes: '121001–121107',
        lat: 28.4089,
        lng: 77.3178,
        cities: [
          { name: 'Faridabad', lgdCode: 'LGD-CT-800441', pinCodes: '121001', lat: 28.4089, lng: 77.3178 },
        ],
      },
    ],
  },
  {
    slug: 'himachal-pradesh',
    name: 'Himachal Pradesh',
    level: 'state',
    lgdCode: 'LGD-ST-02',
    censusCode: '02',
    isoCode: 'IN-HP',
    capital: 'Shimla',
    pinCodes: '171001–177601',
    lat: 31.1048,
    lng: 77.1734,
    regionZone: 'North India',
    officialLanguages: ['hi', 'doi', 'en'],
    nativeNames: { hi: 'हिमाचल प्रदेश', doi: 'हिमाचल प्रदेश' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online citizen documentation, tourism FSSAI licences, MSME/Udyam setup, and tax compliance across Shimla, Kangra, Mandi, and Himachal Pradesh.',
    districts: [
      {
        name: 'Shimla',
        lgdCode: 'LGD-DT-028',
        pinCodes: '171001–172201',
        lat: 31.1048,
        lng: 77.1734,
        cities: [
          { name: 'Shimla', lgdCode: 'LGD-CT-800136', pinCodes: '171001', lat: 31.1048, lng: 77.1734 },
        ],
      },
      {
        name: 'Kangra',
        lgdCode: 'LGD-DT-023',
        pinCodes: '176001–176404',
        lat: 32.0998,
        lng: 76.2691,
        cities: [
          { name: 'Dharamshala', lgdCode: 'LGD-CT-800112', pinCodes: '176215', lat: 32.219, lng: 76.3234 },
        ],
      },
    ],
  },
  {
    slug: 'jharkhand',
    name: 'Jharkhand',
    level: 'state',
    lgdCode: 'LGD-ST-20',
    censusCode: '20',
    isoCode: 'IN-JH',
    capital: 'Ranchi',
    pinCodes: '814101–835325',
    lat: 23.6102,
    lng: 85.2799,
    regionZone: 'East India',
    officialLanguages: ['hi', 'sat', 'mai', 'bn', 'en'],
    nativeNames: { hi: 'झारखण्ड', sat: 'ᱡᱷᱟᱨᱠᱷᱚᱸᱰ' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'PAN card, Jharsewa certificate documentation support, GST, Udyam MSME, and PF/ESIC services across Ranchi, Jamshedpur, Dhanbad, and all 24 Jharkhand districts.',
    districts: [
      {
        name: 'Ranchi',
        lgdCode: 'LGD-DT-346',
        pinCodes: '834001–835325',
        lat: 23.3441,
        lng: 85.3096,
        cities: [
          { name: 'Ranchi', lgdCode: 'LGD-CT-801793', pinCodes: '834001', lat: 23.3441, lng: 85.3096 },
        ],
      },
      {
        name: 'East Singhbhum',
        lgdCode: 'LGD-DT-334',
        pinCodes: '831001–832404',
        lat: 22.8046,
        lng: 86.2029,
        cities: [
          { name: 'Jamshedpur', lgdCode: 'LGD-CT-801798', pinCodes: '831001', lat: 22.8046, lng: 86.2029 },
        ],
      },
    ],
  },
  {
    slug: 'karnataka',
    name: 'Karnataka',
    level: 'state',
    lgdCode: 'LGD-ST-29',
    censusCode: '29',
    isoCode: 'IN-KA',
    capital: 'Bengaluru',
    pinCodes: '560001–591346',
    lat: 15.3173,
    lng: 75.7139,
    regionZone: 'South India',
    officialLanguages: ['kn', 'en', 'kok', 'ur'],
    nativeNames: { kn: 'ಕರ್ನಾಟಕ', hi: 'कर्नाटक' },
    highlightedServiceSlugs: [
      'private-limited-company-registration',
      'startup-india-dpiit-recognition',
      'gst-registration',
      'trademark-registration',
      'income-tax-return-itr-1',
      'pan-card',
    ],
    summary:
      'Startup incorporation, DPIIT Startup India recognition, Trademark, GST, ROC compliance, and citizen services across Bengaluru, Mysuru, Mangaluru, and Karnataka.',
    districts: [
      {
        name: 'Bengaluru Urban',
        lgdCode: 'LGD-DT-525',
        pinCodes: '560001–562165',
        lat: 12.9716,
        lng: 77.5946,
        nativeNames: { kn: 'ಬೆಂಗಳೂರು ನಗರ' },
        cities: [
          { name: 'Bengaluru', lgdCode: 'LGD-CT-803162', pinCodes: '560001', lat: 12.9716, lng: 77.5946, nativeNames: { kn: 'ಬೆಂಗಳೂರು' } },
        ],
      },
      {
        name: 'Mysuru',
        lgdCode: 'LGD-DT-546',
        pinCodes: '570001–571617',
        lat: 12.2958,
        lng: 76.6394,
        cities: [
          { name: 'Mysuru', lgdCode: 'LGD-CT-803197', pinCodes: '570001', lat: 12.2958, lng: 76.6394, nativeNames: { kn: 'ಮೈಸೂರು' } },
        ],
      },
      {
        name: 'Dakshina Kannada',
        lgdCode: 'LGD-DT-531',
        pinCodes: '574141–575030',
        lat: 12.9141,
        lng: 74.856,
        cities: [
          { name: 'Mangaluru', lgdCode: 'LGD-CT-803179', pinCodes: '575001', lat: 12.9141, lng: 74.856 },
        ],
      },
    ],
  },
  {
    slug: 'kerala',
    name: 'Kerala',
    level: 'state',
    lgdCode: 'LGD-ST-32',
    censusCode: '32',
    isoCode: 'IN-KL',
    capital: 'Thiruvananthapuram',
    pinCodes: '670001–695615',
    lat: 10.8505,
    lng: 76.2711,
    regionZone: 'South India',
    officialLanguages: ['ml', 'en'],
    nativeNames: { ml: 'കേരളം', hi: 'केरल' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Passport/Apostille coordination, FSSAI, Udyam MSME, GST, NRI tax filing, and citizen documentation across all 14 districts of Kerala.',
    districts: [
      {
        name: 'Ernakulam',
        lgdCode: 'LGD-DT-556',
        pinCodes: '682001–686693',
        lat: 9.9312,
        lng: 76.2673,
        nativeNames: { ml: 'എറണാകുളം' },
        cities: [
          { name: 'Kochi', lgdCode: 'LGD-CT-803299', pinCodes: '682001', lat: 9.9312, lng: 76.2673, nativeNames: { ml: 'കൊച്ചി' } },
        ],
      },
      {
        name: 'Thiruvananthapuram',
        lgdCode: 'LGD-DT-567',
        pinCodes: '695001–695615',
        lat: 8.5241,
        lng: 76.9366,
        cities: [
          { name: 'Thiruvananthapuram', lgdCode: 'LGD-CT-803328', pinCodes: '695001', lat: 8.5241, lng: 76.9366, nativeNames: { ml: 'തിരുവനന്തപുരം' } },
        ],
      },
    ],
  },
  {
    slug: 'madhya-pradesh',
    name: 'Madhya Pradesh',
    level: 'state',
    lgdCode: 'LGD-ST-23',
    censusCode: '23',
    isoCode: 'IN-MP',
    capital: 'Bhopal',
    pinCodes: '450001–488448',
    lat: 22.9734,
    lng: 78.6569,
    regionZone: 'Central India',
    officialLanguages: ['hi', 'en', 'sa'],
    nativeNames: { hi: 'मध्य प्रदेश', mr: 'मध्य प्रदेश' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online PAN, Gazette name change, MP Gumasta/Shop Act, GST registration, ITR filing, and Udyam MSME services across Indore, Bhopal, Jabalpur, and Gwalior.',
    districts: [
      {
        name: 'Indore',
        lgdCode: 'LGD-DT-407',
        pinCodes: '452001–453771',
        lat: 22.7196,
        lng: 75.8577,
        nativeNames: { hi: 'इन्दौर' },
        cities: [
          { name: 'Indore', lgdCode: 'LGD-CT-802247', pinCodes: '452001', lat: 22.7196, lng: 75.8577 },
        ],
      },
      {
        name: 'Bhopal',
        lgdCode: 'LGD-DT-395',
        pinCodes: '462001–463111',
        lat: 23.2599,
        lng: 77.4126,
        nativeNames: { hi: 'भोपाल' },
        cities: [
          { name: 'Bhopal', lgdCode: 'LGD-CT-802312', pinCodes: '462001', lat: 23.2599, lng: 77.4126 },
        ],
      },
    ],
  },
  {
    slug: 'maharashtra',
    name: 'Maharashtra',
    level: 'state',
    lgdCode: 'LGD-ST-27',
    censusCode: '27',
    isoCode: 'IN-MH',
    capital: 'Mumbai',
    pinCodes: '400001–445402',
    lat: 19.7515,
    lng: 75.7139,
    regionZone: 'West India',
    officialLanguages: ['mr', 'hi', 'en', 'kok', 'ur'],
    nativeNames: { mr: 'महाराष्ट्र', hi: 'महाराष्ट्र', gu: 'મહારાષ્ટ્ર' },
    highlightedServiceSlugs: [
      'shop-and-establishment-registration',
      'gst-registration',
      'gazette-name-change',
      'private-limited-company-registration',
      'pan-card',
      'udyam-registration',
    ],
    summary:
      'Gumasta Shop Act, Maharashtra Gazette name change, GST registration, Professional Tax (PTRC/PTEC), ROC filings, and citizen certificates across Mumbai, Pune, Thane, Nagpur, and Palghar.',
    districts: [
      {
        name: 'Mumbai Suburban',
        lgdCode: 'LGD-DT-488',
        pinCodes: '400049–400104',
        lat: 19.1538,
        lng: 72.8752,
        nativeNames: { mr: 'मुंबई उपनगर' },
        cities: [
          { name: 'Mumbai', lgdCode: 'LGD-CT-802798', pinCodes: '400001', lat: 19.076, lng: 72.8777, nativeNames: { mr: 'मुंबई', hi: 'मुंबई' } },
        ],
      },
      {
        name: 'Pune',
        lgdCode: 'LGD-DT-495',
        pinCodes: '411001–413802',
        lat: 18.5204,
        lng: 73.8567,
        nativeNames: { mr: 'पुणे' },
        cities: [
          { name: 'Pune', lgdCode: 'LGD-CT-802815', pinCodes: '411001', lat: 18.5204, lng: 73.8567 },
        ],
      },
      {
        name: 'Palghar',
        lgdCode: 'LGD-DT-665',
        pinCodes: '401102–401607',
        lat: 19.6967,
        lng: 72.7699,
        cities: [
          { name: 'Palghar', lgdCode: 'LGD-CT-802793', pinCodes: '401404', lat: 19.6967, lng: 72.7699 },
          { name: 'Boisar', level: 'town', lgdCode: 'LGD-TN-553425', pinCodes: '401501', lat: 19.7969, lng: 72.756 },
        ],
      },
    ],
  },
  {
    slug: 'manipur',
    name: 'Manipur',
    level: 'state',
    lgdCode: 'LGD-ST-14',
    censusCode: '14',
    isoCode: 'IN-MN',
    capital: 'Imphal',
    pinCodes: '795001–795159',
    lat: 24.6637,
    lng: 93.9063,
    regionZone: 'Northeast India',
    officialLanguages: ['mni', 'en'],
    nativeNames: { mni: 'ꯃꯅꯤꯄꯨꯔ', hi: 'मणिपुर' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Assisted PAN, Passport, Udyam MSME, GST registration, and educational form assistance across Imphal and all districts of Manipur.',
    districts: [
      {
        name: 'Imphal West',
        lgdCode: 'LGD-DT-255',
        pinCodes: '795001–795146',
        lat: 24.817,
        lng: 93.9368,
        cities: [
          { name: 'Imphal', lgdCode: 'LGD-CT-801479', pinCodes: '795001', lat: 24.817, lng: 93.9368, nativeNames: { mni: 'ꯏꯝꯐꯥꯜ' } },
        ],
      },
    ],
  },
  {
    slug: 'meghalaya',
    name: 'Meghalaya',
    level: 'state',
    lgdCode: 'LGD-ST-17',
    censusCode: '17',
    isoCode: 'IN-ML',
    capital: 'Shillong',
    pinCodes: '793001–794115',
    lat: 25.467,
    lng: 91.3662,
    regionZone: 'Northeast India',
    officialLanguages: ['en', 'hi'],
    nativeNames: { hi: 'मेघालय', bn: 'মেঘালয়', as: 'মেঘালয়' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online PAN, Passport, FSSAI, Udyam MSME, and business registration services across Shillong, Tura, and Meghalaya.',
    districts: [
      {
        name: 'East Khasi Hills',
        lgdCode: 'LGD-DT-274',
        pinCodes: '793001–793210',
        lat: 25.5788,
        lng: 91.8933,
        cities: [
          { name: 'Shillong', lgdCode: 'LGD-CT-801538', pinCodes: '793001', lat: 25.5788, lng: 91.8933 },
        ],
      },
    ],
  },
  {
    slug: 'mizoram',
    name: 'Mizoram',
    level: 'state',
    lgdCode: 'LGD-ST-15',
    censusCode: '15',
    isoCode: 'IN-MZ',
    capital: 'Aizawl',
    pinCodes: '796001–796901',
    lat: 23.1645,
    lng: 92.9376,
    regionZone: 'Northeast India',
    officialLanguages: ['en', 'hi'],
    nativeNames: { hi: 'मिज़ोरम' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Digital citizen applications, PAN, Passport, FSSAI, and MSME Udyam registration facilitation across Aizawl, Lunglei, and Mizoram.',
    districts: [
      {
        name: 'Aizawl',
        lgdCode: 'LGD-DT-261',
        pinCodes: '796001–796470',
        lat: 23.7271,
        lng: 92.7176,
        cities: [
          { name: 'Aizawl', lgdCode: 'LGD-CT-801507', pinCodes: '796001', lat: 23.7271, lng: 92.7176 },
        ],
      },
    ],
  },
  {
    slug: 'nagaland',
    name: 'Nagaland',
    level: 'state',
    lgdCode: 'LGD-ST-13',
    censusCode: '13',
    isoCode: 'IN-NL',
    capital: 'Kohima',
    pinCodes: '797001–798627',
    lat: 26.1584,
    lng: 94.5624,
    regionZone: 'Northeast India',
    officialLanguages: ['en'],
    nativeNames: { hi: 'नागालैंड' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Assisted PAN, Passport, GST, Udyam MSME, and education scholarship support across Kohima, Dimapur, and Nagaland.',
    districts: [
      {
        name: 'Kohima',
        lgdCode: 'LGD-DT-246',
        pinCodes: '797001–797109',
        lat: 25.6751,
        lng: 94.1086,
        cities: [
          { name: 'Kohima', lgdCode: 'LGD-CT-801448', pinCodes: '797001', lat: 25.6751, lng: 94.1086 },
        ],
      },
      {
        name: 'Dimapur',
        lgdCode: 'LGD-DT-244',
        pinCodes: '797112–797118',
        lat: 25.9091,
        lng: 93.7266,
        cities: [
          { name: 'Dimapur', lgdCode: 'LGD-CT-801447', pinCodes: '797112', lat: 25.9091, lng: 93.7266 },
        ],
      },
    ],
  },
  {
    slug: 'odisha',
    name: 'Odisha',
    level: 'state',
    lgdCode: 'LGD-ST-21',
    censusCode: '21',
    isoCode: 'IN-OR',
    capital: 'Bhubaneswar',
    pinCodes: '751001–770076',
    lat: 20.9517,
    lng: 85.0985,
    regionZone: 'East India',
    officialLanguages: ['or', 'sat', 'en', 'hi'],
    nativeNames: { or: 'ଓଡ଼ିଶା', hi: 'ओडिशा' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online PAN, GST registration, Udyam MSME, FSSAI, Shop & Establishment, and citizen documentation across Bhubaneswar, Cuttack, Rourkela, and all 30 Odisha districts.',
    districts: [
      {
        name: 'Khordha',
        lgdCode: 'LGD-DT-364',
        pinCodes: '751001–752064',
        lat: 20.1863,
        lng: 85.6223,
        nativeNames: { or: 'ଖୋର୍ଦ୍ଧା' },
        cities: [
          { name: 'Bhubaneswar', lgdCode: 'LGD-CT-801868', pinCodes: '751001', lat: 20.2961, lng: 85.8245, nativeNames: { or: 'ଭୁବନେଶ୍ୱର' } },
        ],
      },
      {
        name: 'Cuttack',
        lgdCode: 'LGD-DT-353',
        pinCodes: '753001–754292',
        lat: 20.4625,
        lng: 85.883,
        cities: [
          { name: 'Cuttack', lgdCode: 'LGD-CT-801846', pinCodes: '753001', lat: 20.4625, lng: 85.883, nativeNames: { or: 'କଟକ' } },
        ],
      },
    ],
  },
  {
    slug: 'punjab',
    name: 'Punjab',
    level: 'state',
    lgdCode: 'LGD-ST-03',
    censusCode: '03',
    isoCode: 'IN-PB',
    capital: 'Chandigarh',
    pinCodes: '140001–160104',
    lat: 31.1471,
    lng: 75.3412,
    regionZone: 'North India',
    officialLanguages: ['pa', 'hi', 'en'],
    nativeNames: { pa: 'ਪੰਜਾਬ', hi: 'पंजाब' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Passport, Apostille, IEC export code, GST, Udyam MSME, and tax compliance facilitation across Ludhiana, Amritsar, Jalandhar, Mohali, and all 23 districts of Punjab.',
    districts: [
      {
        name: 'Ludhiana',
        lgdCode: 'LGD-DT-041',
        pinCodes: '141001–142057',
        lat: 30.901,
        lng: 75.8573,
        nativeNames: { pa: 'ਲੁਧਿਆਣਾ' },
        cities: [
          { name: 'Ludhiana', lgdCode: 'LGD-CT-800191', pinCodes: '141001', lat: 30.901, lng: 75.8573 },
        ],
      },
      {
        name: 'Amritsar',
        lgdCode: 'LGD-DT-033',
        pinCodes: '143001–143606',
        lat: 31.634,
        lng: 74.8723,
        cities: [
          { name: 'Amritsar', lgdCode: 'LGD-CT-800249', pinCodes: '143001', lat: 31.634, lng: 74.8723, nativeNames: { pa: 'ਅੰਮ੍ਰਿਤਸਰ' } },
        ],
      },
    ],
  },
  {
    slug: 'rajasthan',
    name: 'Rajasthan',
    level: 'state',
    lgdCode: 'LGD-ST-08',
    censusCode: '08',
    isoCode: 'IN-RJ',
    capital: 'Jaipur',
    pinCodes: '301001–345034',
    lat: 27.0238,
    lng: 74.2179,
    regionZone: 'West India',
    officialLanguages: ['hi', 'sd', 'en'],
    nativeNames: { hi: 'राजस्थान' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Transparent online PAN, Gazette name change, Udyam MSME, GST, FSSAI, and ITR assistance across Jaipur, Jodhpur, Udaipur, Kota, and all Rajasthan districts.',
    districts: [
      {
        name: 'Jaipur',
        lgdCode: 'LGD-DT-110',
        pinCodes: '302001–303908',
        lat: 26.9124,
        lng: 75.7873,
        nativeNames: { hi: 'जयपुर' },
        cities: [
          { name: 'Jaipur', lgdCode: 'LGD-CT-800547', pinCodes: '302001', lat: 26.9124, lng: 75.7873 },
        ],
      },
      {
        name: 'Jodhpur',
        lgdCode: 'LGD-DT-113',
        pinCodes: '342001–342902',
        lat: 26.2389,
        lng: 73.0243,
        cities: [
          { name: 'Jodhpur', lgdCode: 'LGD-CT-800572', pinCodes: '342001', lat: 26.2389, lng: 73.0243 },
        ],
      },
    ],
  },
  {
    slug: 'sikkim',
    name: 'Sikkim',
    level: 'state',
    lgdCode: 'LGD-ST-11',
    censusCode: '11',
    isoCode: 'IN-SK',
    capital: 'Gangtok',
    pinCodes: '737101–737139',
    lat: 27.533,
    lng: 88.5122,
    regionZone: 'Northeast India',
    officialLanguages: ['ne', 'en', 'hi'],
    nativeNames: { ne: 'सिक्किम', hi: 'सिक्किम' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online PAN, hospitality FSSAI, tourism trade registration, Udyam MSME, and citizen documentation across Gangtok and Sikkim.',
    districts: [
      {
        name: 'Gangtok',
        lgdCode: 'LGD-DT-225',
        pinCodes: '737101–737135',
        lat: 27.3314,
        lng: 88.6138,
        nativeNames: { ne: 'गान्तोक' },
        cities: [
          { name: 'Gangtok', lgdCode: 'LGD-CT-801414', pinCodes: '737101', lat: 27.3314, lng: 88.6138 },
        ],
      },
    ],
  },
  {
    slug: 'tamil-nadu',
    name: 'Tamil Nadu',
    level: 'state',
    lgdCode: 'LGD-ST-33',
    censusCode: '33',
    isoCode: 'IN-TN',
    capital: 'Chennai',
    pinCodes: '600001–643253',
    lat: 11.1271,
    lng: 78.6569,
    regionZone: 'South India',
    officialLanguages: ['ta', 'en'],
    nativeNames: { ta: 'தமிழ்நாடு', hi: 'तमिलनाडु' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'GST, Private Limited incorporation, Udyam MSME, Trademark, FSSAI, and citizen documentation support across Chennai, Coimbatore, Madurai, and all 38 Tamil Nadu districts.',
    districts: [
      {
        name: 'Chennai',
        lgdCode: 'LGD-DT-568',
        pinCodes: '600001–600130',
        lat: 13.0827,
        lng: 80.2707,
        nativeNames: { ta: 'சென்னை' },
        cities: [
          { name: 'Chennai', lgdCode: 'LGD-CT-803339', pinCodes: '600001', lat: 13.0827, lng: 80.2707, nativeNames: { ta: 'சென்னை' } },
        ],
      },
      {
        name: 'Coimbatore',
        lgdCode: 'LGD-DT-569',
        pinCodes: '641001–642207',
        lat: 11.0168,
        lng: 76.9558,
        cities: [
          { name: 'Coimbatore', lgdCode: 'LGD-CT-803881', pinCodes: '641001', lat: 11.0168, lng: 76.9558, nativeNames: { ta: 'கோயம்புத்தூர்' } },
        ],
      },
      {
        name: 'Madurai',
        lgdCode: 'LGD-DT-579',
        pinCodes: '625001–625708',
        lat: 9.9252,
        lng: 78.1198,
        cities: [
          { name: 'Madurai', lgdCode: 'LGD-CT-803736', pinCodes: '625001', lat: 9.9252, lng: 78.1198, nativeNames: { ta: 'மதுரை' } },
        ],
      },
    ],
  },
  {
    slug: 'telangana',
    name: 'Telangana',
    level: 'state',
    lgdCode: 'LGD-ST-36',
    censusCode: '36',
    isoCode: 'IN-TG',
    capital: 'Hyderabad',
    pinCodes: '500001–509412',
    lat: 18.1124,
    lng: 79.0193,
    regionZone: 'South India',
    officialLanguages: ['te', 'ur', 'en', 'hi'],
    nativeNames: { te: 'తెలంగాణ', ur: 'تلنگانہ', hi: 'तेलंगाना' },
    highlightedServiceSlugs: [
      'private-limited-company-registration',
      'gst-registration',
      'startup-india-dpiit-recognition',
      'trademark-registration',
      'pan-card',
      'income-tax-return-itr-1',
    ],
    summary:
      'Startup incorporation, DPIIT registration, GST, Labour Shop & Establishment, PAN, and ITR compliance across Hyderabad, Warangal, and all 33 Telangana districts.',
    districts: [
      {
        name: 'Hyderabad',
        lgdCode: 'LGD-DT-507',
        pinCodes: '500001–500098',
        lat: 17.385,
        lng: 78.4867,
        nativeNames: { te: 'హైదరాబాద్', ur: 'حیدرآباد' },
        cities: [
          { name: 'Hyderabad', lgdCode: 'LGD-CT-802918', pinCodes: '500001', lat: 17.385, lng: 78.4867, nativeNames: { te: 'హైదరాబాద్', ur: 'حیدرآباد' } },
        ],
      },
      {
        name: 'Hanumakonda',
        lgdCode: 'LGD-DT-686',
        pinCodes: '506001–506371',
        lat: 17.9689,
        lng: 79.5941,
        cities: [
          { name: 'Warangal', lgdCode: 'LGD-CT-802912', pinCodes: '506002', lat: 17.9689, lng: 79.5941, nativeNames: { te: 'వరంగల్' } },
        ],
      },
    ],
  },
  {
    slug: 'tripura',
    name: 'Tripura',
    level: 'state',
    lgdCode: 'LGD-ST-16',
    censusCode: '16',
    isoCode: 'IN-TR',
    capital: 'Agartala',
    pinCodes: '799001–799290',
    lat: 23.9408,
    lng: 91.9882,
    regionZone: 'Northeast India',
    officialLanguages: ['bn', 'en', 'hi'],
    nativeNames: { bn: 'ত্রিপুরা', hi: 'त्रिपुरा' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online PAN, GST registration, Udyam MSME, Passport, and education documentation across Agartala and all 8 districts of Tripura.',
    districts: [
      {
        name: 'West Tripura',
        lgdCode: 'LGD-DT-272',
        pinCodes: '799001–799211',
        lat: 23.8315,
        lng: 91.2868,
        cities: [
          { name: 'Agartala', lgdCode: 'LGD-CT-801525', pinCodes: '799001', lat: 23.8315, lng: 91.2868, nativeNames: { bn: 'আগরতলা' } },
        ],
      },
    ],
  },
  {
    slug: 'uttar-pradesh',
    name: 'Uttar Pradesh',
    level: 'state',
    lgdCode: 'LGD-ST-09',
    censusCode: '09',
    isoCode: 'IN-UP',
    capital: 'Lucknow',
    pinCodes: '201001–285223',
    lat: 26.8467,
    lng: 80.9462,
    regionZone: 'North India',
    officialLanguages: ['hi', 'ur', 'en'],
    nativeNames: { hi: 'उत्तर प्रदेश', ur: 'اتر پردیش' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Full-state online PAN, Gazette name change, UP Shop/GST registration, Udyam MSME, and ITR compliance across Lucknow, Noida, Kanpur, Varanasi, and all 75 UP districts.',
    districts: [
      {
        name: 'Lucknow',
        lgdCode: 'LGD-DT-156',
        pinCodes: '226001–227309',
        lat: 26.8467,
        lng: 80.9462,
        nativeNames: { hi: 'लखनऊ', ur: 'لکھنؤ' },
        cities: [
          { name: 'Lucknow', lgdCode: 'LGD-CT-800971', pinCodes: '226001', lat: 26.8467, lng: 80.9462, nativeNames: { hi: 'लखनऊ' } },
        ],
      },
      {
        name: 'Gautam Buddha Nagar',
        lgdCode: 'LGD-DT-140',
        pinCodes: '201301–203209',
        lat: 28.5355,
        lng: 77.391,
        cities: [
          { name: 'Noida', lgdCode: 'LGD-CT-800733', pinCodes: '201301', lat: 28.5355, lng: 77.391, nativeNames: { hi: 'नोएडा' } },
        ],
      },
      {
        name: 'Varanasi',
        lgdCode: 'LGD-DT-184',
        pinCodes: '221001–221406',
        lat: 25.3176,
        lng: 82.9739,
        cities: [
          { name: 'Varanasi', lgdCode: 'LGD-CT-801230', pinCodes: '221001', lat: 25.3176, lng: 82.9739, nativeNames: { hi: 'वाराणसी' } },
        ],
      },
      {
        name: 'Kanpur Nagar',
        lgdCode: 'LGD-DT-148',
        pinCodes: '208001–209402',
        lat: 26.4499,
        lng: 80.3319,
        cities: [
          { name: 'Kanpur', lgdCode: 'LGD-CT-800991', pinCodes: '208001', lat: 26.4499, lng: 80.3319 },
        ],
      },
    ],
  },
  {
    slug: 'uttarakhand',
    name: 'Uttarakhand',
    level: 'state',
    lgdCode: 'LGD-ST-05',
    censusCode: '05',
    isoCode: 'IN-UT',
    capital: 'Dehradun',
    pinCodes: '244712–263680',
    lat: 30.0668,
    lng: 79.0193,
    regionZone: 'North India',
    officialLanguages: ['hi', 'sa', 'en'],
    nativeNames: { hi: 'उत्तराखण्ड', sa: 'उत्तराखण्डराज्यम्' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online PAN, hospitality FSSAI, GST, Udyam MSME, and citizen certificate assistance across Dehradun, Haridwar, Haldwani, and all 13 districts of Uttarakhand.',
    districts: [
      {
        name: 'Dehradun',
        lgdCode: 'LGD-DT-049',
        pinCodes: '248001–249205',
        lat: 30.3165,
        lng: 78.0322,
        cities: [
          { name: 'Dehradun', lgdCode: 'LGD-CT-800308', pinCodes: '248001', lat: 30.3165, lng: 78.0322, nativeNames: { hi: 'देहरादून' } },
          { name: 'Rishikesh', level: 'town', lgdCode: 'LGD-TN-800310', pinCodes: '249201', lat: 30.0869, lng: 78.2676 },
        ],
      },
      {
        name: 'Haridwar',
        lgdCode: 'LGD-DT-051',
        pinCodes: '247661–249411',
        lat: 29.9457,
        lng: 78.1642,
        cities: [
          { name: 'Haridwar', lgdCode: 'LGD-CT-800368', pinCodes: '249401', lat: 29.9457, lng: 78.1642 },
        ],
      },
    ],
  },
  {
    slug: 'west-bengal',
    name: 'West Bengal',
    level: 'state',
    lgdCode: 'LGD-ST-19',
    censusCode: '19',
    isoCode: 'IN-WB',
    capital: 'Kolkata',
    pinCodes: '700001–743711',
    lat: 22.9868,
    lng: 87.855,
    regionZone: 'East India',
    officialLanguages: ['bn', 'ne', 'sat', 'hi', 'en', 'ur'],
    nativeNames: { bn: 'পশ্চিমবঙ্গ', ne: 'पश्चिम बङ्गाल', hi: 'पश्चिम बंगाल' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'West Bengal Trade Enlistment, GST registration, FSSAI, Udyam MSME, ROC annual filings, and PAN/ITR services across Kolkata, Howrah, Siliguri, and Durgapur.',
    districts: [
      {
        name: 'Kolkata',
        lgdCode: 'LGD-DT-315',
        pinCodes: '700001–700163',
        lat: 22.5726,
        lng: 88.3639,
        nativeNames: { bn: 'কলকাতা' },
        cities: [
          { name: 'Kolkata', lgdCode: 'LGD-CT-801725', pinCodes: '700001', lat: 22.5726, lng: 88.3639, nativeNames: { bn: 'কলকাতা', hi: 'कोलकाता' } },
        ],
      },
      {
        name: 'Darjeeling',
        lgdCode: 'LGD-DT-309',
        pinCodes: '734001–734436',
        lat: 27.041,
        lng: 88.2663,
        cities: [
          { name: 'Siliguri', lgdCode: 'LGD-CT-801655', pinCodes: '734001', lat: 26.7271, lng: 88.3953, nativeNames: { bn: 'শিলিগুড়ি', ne: 'सिलीगुडी' } },
        ],
      },
      {
        name: 'Howrah',
        lgdCode: 'LGD-DT-311',
        pinCodes: '711101–711414',
        lat: 22.5958,
        lng: 88.2636,
        cities: [
          { name: 'Howrah', lgdCode: 'LGD-CT-801718', pinCodes: '711101', lat: 22.5958, lng: 88.2636 },
        ],
      },
    ],
  },

  // ==========================================
  // 8 UNION TERRITORIES
  // ==========================================
  {
    slug: 'andaman-and-nicobar-islands',
    name: 'Andaman and Nicobar Islands',
    level: 'ut',
    lgdCode: 'LGD-UT-35',
    censusCode: '35',
    isoCode: 'IN-AN',
    capital: 'Sri Vijaya Puram (Port Blair)',
    pinCodes: '744101–744304',
    lat: 11.7401,
    lng: 92.6586,
    regionZone: 'Island Territories',
    officialLanguages: ['en', 'hi', 'bn', 'ta'],
    nativeNames: { hi: 'अंडमान और निकोबार द्वीप समूह', bn: 'আন্দামান ও নিকোবর দ্বীপপুঞ্জ', ta: 'அந்தமான் நிக்கோபார் தீவுகள்' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online citizen ID, Passport assistance, island hospitality FSSAI, GST, and Udyam MSME documentation across Sri Vijaya Puram (Port Blair) and Nicobar.',
    districts: [
      {
        name: 'South Andaman',
        lgdCode: 'LGD-DT-603',
        pinCodes: '744101–744207',
        lat: 11.6234,
        lng: 92.7265,
        cities: [
          { name: 'Port Blair', lgdCode: 'LGD-CT-804041', pinCodes: '744101', lat: 11.6234, lng: 92.7265 },
        ],
      },
    ],
  },
  {
    slug: 'chandigarh',
    name: 'Chandigarh',
    level: 'ut',
    lgdCode: 'LGD-UT-04',
    censusCode: '04',
    isoCode: 'IN-CH',
    capital: 'Chandigarh',
    pinCodes: '160001–160103',
    lat: 30.7333,
    lng: 76.7794,
    regionZone: 'North India',
    officialLanguages: ['en', 'hi', 'pa'],
    nativeNames: { hi: 'चंडीगढ़', pa: 'ਚੰਡੀਗੜ੍ਹ' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Company incorporation, GST, ITR filing, Trademark, Passport, and Apostille facilitation for Chandigarh Tricity businesses and residents.',
    districts: [
      {
        name: 'Chandigarh',
        lgdCode: 'LGD-DT-044',
        pinCodes: '160001–160103',
        lat: 30.7333,
        lng: 76.7794,
        cities: [
          { name: 'Chandigarh', lgdCode: 'LGD-CT-800283', pinCodes: '160001', lat: 30.7333, lng: 76.7794, nativeNames: { pa: 'ਚੰਡੀਗੜ੍ਹ', hi: 'चंडीगढ़' } },
        ],
      },
    ],
  },
  {
    slug: 'dadra-and-nagar-haveli-and-daman-and-diu',
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    level: 'ut',
    lgdCode: 'LGD-UT-38',
    censusCode: '38',
    isoCode: 'IN-DH',
    capital: 'Daman',
    pinCodes: '362520–396240',
    lat: 20.3974,
    lng: 72.8328,
    regionZone: 'West India',
    officialLanguages: ['gu', 'hi', 'mr', 'en'],
    nativeNames: {
      gu: 'દાદરા અને નગર હવેલી અને દમણ અને દીવ',
      hi: 'दादरा और नगर हवेली और दमन और दीव',
      mr: 'दादरा आणि नगर हवेली आणि दमण आणि दीव',
    },
    highlightedServiceSlugs: [
      'pan-card',
      'gst-registration',
      'udyam-registration',
      'trade-licence-assistance',
      'fssai-state-licence',
      'gazette-name-change',
    ],
    summary:
      'Headquarters Territory of Digital India Project (Samarvani, Silvassa – 396230). Rapid online and local desk support for GIDC/Piparia/Amli/Dabhel industries and citizens across Silvassa, Daman, and Diu.',
    districts: [
      {
        name: 'Dadra and Nagar Haveli',
        lgdCode: 'LGD-DT-465',
        pinCodes: '396230–396240',
        lat: 20.2737,
        lng: 73.0192,
        nativeNames: { gu: 'દાદરા અને નગર હવેલી', hi: 'दादरा और नगर हवेली' },
        cities: [
          {
            name: 'Silvassa',
            lgdCode: 'LGD-CT-802646',
            pinCodes: '396230',
            lat: 20.2737,
            lng: 73.0192,
            nativeNames: { gu: 'સેલવાસ', hi: 'सिलवासा', mr: 'सिल्वासा' },
            summary:
              'Head Office Desk at Sunflower Building, Nano City, Samarvani, Silvassa (396230). Serving Silvassa GIDC, Piparia, Amli, Naroli, and Khanvel with transparent PAN, GST, MSME, Trade Licence, ITR, and digital tools.',
          },
          {
            name: 'Naroli',
            level: 'town',
            lgdCode: 'LGD-TN-524705',
            pinCodes: '396235',
            lat: 20.296,
            lng: 72.967,
            nativeNames: { gu: 'નરોલી', hi: 'नरोली' },
          },
        ],
      },
      {
        name: 'Daman',
        lgdCode: 'LGD-DT-463',
        pinCodes: '396210–396220',
        lat: 20.3974,
        lng: 72.8328,
        nativeNames: { gu: 'દમણ', hi: 'दमन' },
        cities: [
          {
            name: 'Daman',
            lgdCode: 'LGD-CT-802644',
            pinCodes: '396210',
            lat: 20.3974,
            lng: 72.8328,
            nativeNames: { gu: 'દમણ', hi: 'दमन' },
            summary:
              'Supporting Daman manufacturers (Somnath & Dabhel estates), hospitality businesses, and residents with FSSAI licences, GST, IEC export codes, and Passport assistance.',
          },
        ],
      },
      {
        name: 'Diu',
        lgdCode: 'LGD-DT-464',
        pinCodes: '362520–362540',
        lat: 20.7144,
        lng: 70.9874,
        nativeNames: { gu: 'દીવ', hi: 'दीव' },
        cities: [
          {
            name: 'Diu',
            lgdCode: 'LGD-CT-802645',
            pinCodes: '362520',
            lat: 20.7144,
            lng: 70.9874,
            nativeNames: { gu: 'દીવ', hi: 'दीव' },
          },
        ],
      },
    ],
  },
  {
    slug: 'delhi',
    name: 'Delhi (NCT)',
    level: 'ut',
    lgdCode: 'LGD-UT-07',
    censusCode: '07',
    isoCode: 'IN-DL',
    capital: 'New Delhi',
    pinCodes: '110001–110097',
    lat: 28.7041,
    lng: 77.1025,
    regionZone: 'North India',
    officialLanguages: ['hi', 'en', 'pa', 'ur'],
    nativeNames: { hi: 'दिल्ली', pa: 'ਦਿੱਲੀ', ur: 'دہلی' },
    highlightedServiceSlugs: [
      'private-limited-company-registration',
      'gst-registration',
      'gazette-name-change',
      'trademark-registration',
      'apostille-legalization-coordination',
      'pan-card',
    ],
    summary:
      'Delhi Gazette name change publishing, MEA Apostille coordination, Pvt Ltd / LLP formation, GST, Trademark, and tax compliance across all 11 Delhi NCR districts.',
    districts: [
      {
        name: 'New Delhi',
        lgdCode: 'LGD-DT-085',
        pinCodes: '110001–110075',
        lat: 28.6139,
        lng: 77.209,
        nativeNames: { hi: 'नई दिल्ली', ur: 'نئی دہلی' },
        cities: [
          { name: 'New Delhi', lgdCode: 'LGD-CT-800442', pinCodes: '110001', lat: 28.6139, lng: 77.209, nativeNames: { hi: 'नई दिल्ली' } },
        ],
      },
      {
        name: 'South Delhi',
        lgdCode: 'LGD-DT-090',
        pinCodes: '110016–110080',
        lat: 28.5273,
        lng: 77.2059,
        cities: [
          { name: 'Saket', level: 'town', lgdCode: 'LGD-TN-110017', pinCodes: '110017', lat: 28.5246, lng: 77.2066 },
        ],
      },
    ],
  },
  {
    slug: 'jammu-and-kashmir',
    name: 'Jammu and Kashmir',
    level: 'ut',
    lgdCode: 'LGD-UT-01',
    censusCode: '01',
    isoCode: 'IN-JK',
    capital: 'Srinagar / Jammu',
    pinCodes: '180001–194404',
    lat: 33.7782,
    lng: 76.5762,
    regionZone: 'North India',
    officialLanguages: ['ur', 'ks', 'doi', 'hi', 'en'],
    nativeNames: { ur: 'جموں و کشمیر', ks: 'جۆم تہٕ کٔشیٖر', doi: 'जम्मू ते कश्मीर', hi: 'जम्मू और कश्मीर' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Bilingual and multilingual online PAN, Passport, Udyam MSME, GST, and scholarship assistance across Srinagar, Jammu, Baramulla, and all 20 districts of J&K.',
    districts: [
      {
        name: 'Srinagar',
        lgdCode: 'LGD-DT-014',
        pinCodes: '190001–191202',
        lat: 34.0837,
        lng: 74.7973,
        nativeNames: { ks: 'سِریٖنَگَر', ur: 'سری نگر' },
        cities: [
          { name: 'Srinagar', lgdCode: 'LGD-CT-800024', pinCodes: '190001', lat: 34.0837, lng: 74.7973, nativeNames: { ur: 'سری نگر', ks: 'سِریٖنَگَر' } },
        ],
      },
      {
        name: 'Jammu',
        lgdCode: 'LGD-DT-005',
        pinCodes: '180001–181224',
        lat: 32.7266,
        lng: 74.857,
        nativeNames: { doi: 'जम्मू', ur: 'جموں' },
        cities: [
          { name: 'Jammu', lgdCode: 'LGD-CT-800073', pinCodes: '180001', lat: 32.7266, lng: 74.857 },
        ],
      },
    ],
  },
  {
    slug: 'ladakh',
    name: 'Ladakh',
    level: 'ut',
    lgdCode: 'LGD-UT-37',
    censusCode: '37',
    isoCode: 'IN-LA',
    capital: 'Leh',
    pinCodes: '194101–194404',
    lat: 34.1526,
    lng: 77.5771,
    regionZone: 'North India',
    officialLanguages: ['en', 'hi', 'ur', 'ks'],
    nativeNames: { hi: 'लद्दाख', ur: 'لداخ' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online citizen PAN, Passport, eco-tourism FSSAI, GST, and MSME registration services for Leh and Kargil districts in Ladakh.',
    districts: [
      {
        name: 'Leh Ladakh',
        lgdCode: 'LGD-DT-009',
        pinCodes: '194101–194404',
        lat: 34.1526,
        lng: 77.5771,
        cities: [
          { name: 'Leh', lgdCode: 'LGD-CT-800043', pinCodes: '194101', lat: 34.1526, lng: 77.5771 },
        ],
      },
      {
        name: 'Kargil',
        lgdCode: 'LGD-DT-006',
        pinCodes: '194103–194302',
        lat: 34.5539,
        lng: 76.1349,
        cities: [
          { name: 'Kargil', level: 'town', lgdCode: 'LGD-TN-800042', pinCodes: '194103', lat: 34.5539, lng: 76.1349 },
        ],
      },
    ],
  },
  {
    slug: 'lakshadweep',
    name: 'Lakshadweep',
    level: 'ut',
    lgdCode: 'LGD-UT-31',
    censusCode: '31',
    isoCode: 'IN-LD',
    capital: 'Kavaratti',
    pinCodes: '682551–682559',
    lat: 10.5667,
    lng: 72.6417,
    regionZone: 'Island Territories',
    officialLanguages: ['ml', 'en'],
    nativeNames: { ml: 'ലക്ഷദ്വീപ്', hi: 'लक्षद्वीप' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Online citizen PAN, Passport, scholarship filing, and fishery/tourism Udyam MSME documentation support for Lakshadweep Islands.',
    districts: [
      {
        name: 'Lakshadweep',
        lgdCode: 'LGD-DT-553',
        pinCodes: '682551–682559',
        lat: 10.5667,
        lng: 72.6417,
        cities: [
          { name: 'Kavaratti', level: 'town', lgdCode: 'LGD-TN-587654', pinCodes: '682555', lat: 10.5667, lng: 72.6417, nativeNames: { ml: 'കവരത്തി' } },
        ],
      },
    ],
  },
  {
    slug: 'puducherry',
    name: 'Puducherry',
    level: 'ut',
    lgdCode: 'LGD-UT-34',
    censusCode: '34',
    isoCode: 'IN-PY',
    capital: 'Puducherry',
    pinCodes: '533464–609609',
    lat: 11.9416,
    lng: 79.8083,
    regionZone: 'South India',
    officialLanguages: ['ta', 'te', 'ml', 'en'],
    nativeNames: { ta: 'புதுச்சேரி', te: 'పుదుచ్చేరి', ml: 'പുതുച്ചേരി', hi: 'पुदुचेरी' },
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    summary:
      'Multi-region documentation, GST, FSSAI, Udyam MSME, and Passport assistance across Puducherry, Karaikal, Mahe, and Yanam.',
    districts: [
      {
        name: 'Puducherry',
        lgdCode: 'LGD-DT-600',
        pinCodes: '605001–605110',
        lat: 11.9416,
        lng: 79.8083,
        nativeNames: { ta: 'புதுச்சேரி' },
        cities: [
          { name: 'Puducherry', lgdCode: 'LGD-CT-804037', pinCodes: '605001', lat: 11.9416, lng: 79.8083, nativeNames: { ta: 'புதுச்சேரி' } },
        ],
      },
      {
        name: 'Karaikal',
        lgdCode: 'LGD-DT-598',
        pinCodes: '609601–609609',
        lat: 10.9254,
        lng: 79.838,
        cities: [
          { name: 'Karaikal', lgdCode: 'LGD-CT-804039', pinCodes: '609602', lat: 10.9254, lng: 79.838 },
        ],
      },
    ],
  },
];

function buildFlatGeographySeed(): IndiaLocationRecord[] {
  const records: IndiaLocationRecord[] = [];
  const countryId = 'loc-in';
  records.push({
    id: countryId,
    slug: 'india',
    parentId: null,
    level: 'country',
    stateSlug: '',
    canonicalPath: '/india',
    name: 'India',
    nativeNames: {
      hi: 'भारत',
      ta: 'இந்தியா',
      te: 'భారతదేశం',
      bn: 'ভারত',
      gu: 'ભારત',
      mr: 'भारत',
      kn: 'ಭಾರತ',
      ml: 'ഭാരതം',
      pa: 'ਭਾਰਤ',
      or: 'ଭାରତ',
      ur: 'بھارت',
    },
    lgdCode: 'LGD-IN-00',
    censusCode: '00',
    isoCode: 'IN',
    capital: 'New Delhi',
    pinCodes: '110001–855117',
    latitude: 20.5937,
    longitude: 78.9629,
    officialLanguages: ['en', 'hi'],
    regionZone: 'Central India',
    sourceAuthority: 'Local Government Directory (LGD), Ministry of Panchayati Raj & Census of India',
    sourceUrl: LGD_SOURCE_URL,
    verified: true,
    published: true,
    indexPolicy: 'index',
    highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
    customSummary:
      'Explore DigitalIndiaProject.com services across all 28 Indian States and 8 Union Territories with multilingual guides in English, Hindi, and all 22 Constitutional Eighth Schedule languages.',
    updatedAt: '2026-06-01T00:00:00.000Z',
  });

  for (const st of STATE_AND_UT_SEEDS) {
    const stateId = `loc-${st.slug}`;
    records.push({
      id: stateId,
      slug: st.slug,
      parentId: countryId,
      level: st.level,
      stateSlug: st.slug,
      canonicalPath: `/india/${st.slug}`,
      name: st.name,
      nativeNames: st.nativeNames,
      lgdCode: st.lgdCode,
      censusCode: st.censusCode,
      isoCode: st.isoCode,
      capital: st.capital,
      pinCodes: st.pinCodes,
      latitude: st.lat,
      longitude: st.lng,
      officialLanguages: st.officialLanguages,
      regionZone: st.regionZone,
      sourceAuthority: 'Local Government Directory (LGD), Ministry of Panchayati Raj, Govt. of India',
      sourceUrl: LGD_SOURCE_URL,
      verified: true,
      published: true,
      indexPolicy: 'index',
      highlightedServiceSlugs: st.highlightedServiceSlugs,
      customSummary: st.summary,
      updatedAt: '2026-06-01T00:00:00.000Z',
    });

    for (const dt of st.districts) {
      const districtSlug = dt.slug || slugifyGeo(dt.name);
      const districtId = `loc-${st.slug}-${districtSlug}`;
      records.push({
        id: districtId,
        slug: districtSlug,
        parentId: stateId,
        level: 'district',
        stateSlug: st.slug,
        districtSlug,
        canonicalPath: `/india/${st.slug}/${districtSlug}`,
        name: dt.name,
        nativeNames: dt.nativeNames || {},
        lgdCode: dt.lgdCode,
        isoCode: st.isoCode,
        pinCodes: dt.pinCodes,
        latitude: dt.lat,
        longitude: dt.lng,
        officialLanguages: st.officialLanguages,
        regionZone: st.regionZone,
        sourceAuthority: 'Local Government Directory (LGD) & Census 2011 District Registry',
        sourceUrl: LGD_SOURCE_URL,
        verified: true,
        published: true,
        indexPolicy: 'index',
        highlightedServiceSlugs: st.highlightedServiceSlugs,
        customSummary: `Digital documentation, PAN Card, GST registration, Udyam MSME, ITR filing, and citizen facilitation services in ${dt.name} district, ${st.name} (PIN ${dt.pinCodes}).`,
        updatedAt: '2026-06-01T00:00:00.000Z',
      });

      for (const ct of dt.cities) {
        const citySlug = ct.slug || slugifyGeo(ct.name);
        const cityId = `loc-${st.slug}-${districtSlug}-${citySlug}`;
        records.push({
          id: cityId,
          slug: citySlug,
          parentId: districtId,
          level: ct.level || 'city',
          stateSlug: st.slug,
          districtSlug,
          citySlug,
          canonicalPath: `/india/${st.slug}/${districtSlug}/${citySlug}`,
          name: ct.name,
          nativeNames: ct.nativeNames || {},
          lgdCode: ct.lgdCode,
          isoCode: st.isoCode,
          pinCodes: ct.pinCodes,
          latitude: ct.lat,
          longitude: ct.lng,
          officialLanguages: st.officialLanguages,
          regionZone: st.regionZone,
          sourceAuthority: 'Local Government Directory (LGD) & IndiaPost PIN Registry',
          sourceUrl: LGD_SOURCE_URL,
          verified: true,
          published: true,
          indexPolicy: 'index',
          highlightedServiceSlugs: st.highlightedServiceSlugs,
          customSummary:
            ct.summary ||
            `Apply online in ${ct.name} (${dt.name} district, ${st.name}, PIN ${ct.pinCodes}) for PAN Card, GST Registration, Udyam MSME, FSSAI Licence, ITR Filing, and citizen documentation with itemized pricing.`,
          updatedAt: '2026-06-01T00:00:00.000Z',
        });
      }
    }
  }

  return records;
}

export const INDIA_GEOGRAPHY_SEED: IndiaLocationRecord[] = buildFlatGeographySeed();

export const INDIA_STATES_AND_UTS: IndiaLocationRecord[] = INDIA_GEOGRAPHY_SEED.filter(
  (l) => l.level === 'state' || l.level === 'ut'
);

export function getStatesCountSummary(locations: IndiaLocationRecord[] = INDIA_GEOGRAPHY_SEED): {
  states: number;
  uts: number;
  districts: number;
  citiesAndTowns: number;
  total: number;
} {
  let states = 0;
  let uts = 0;
  let districts = 0;
  let citiesAndTowns = 0;
  for (const loc of locations) {
    if (loc.level === 'state') states += 1;
    else if (loc.level === 'ut') uts += 1;
    else if (loc.level === 'district') districts += 1;
    else if (loc.level === 'city' || loc.level === 'town') citiesAndTowns += 1;
  }
  return {
    states,
    uts,
    districts,
    citiesAndTowns,
    total: locations.length,
  };
}
