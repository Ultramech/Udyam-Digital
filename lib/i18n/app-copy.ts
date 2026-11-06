/**
 * Copy for the redesigned app shell, home, orders, sign-in and account screens. It sits beside the older dictionaries in messages.ts and is
 * looked up first, so a key written here always wins. Every key exists in all four languages.
 */
type Dict = Record<string, string>;

const row = (en: string, hi: string, mr: string, ta: string) => ({ en, hi, mr, ta });
const COPY: Record<string, { en: string; hi: string; mr: string; ta: string }> = {
  // navigation
  tab_home: row("Home", "होम", "मुख्यपृष्ठ", "முகப்பு"),
  tab_plans: row("Plans", "प्लान", "प्लॅन", "திட்டங்கள்"),
  tab_orders: row("Orders", "ऑर्डर", "ऑर्डर", "ஆர்டர்கள்"),
  tab_help: row("Help", "मदद", "मदत", "உதவி"),
  tab_account: row("Account", "अकाउंट", "खाते", "கணக்கு"),
  sign_in: row("Sign in", "साइन इन", "साइन इन", "உள்நுழை"),
  demo_tools: row("Demo tools", "डेमो टूल", "डेमो साधने", "டெமோ கருவிகள்"),
  flow_1: row("Your business", "आपका बिज़नेस", "तुमचा व्यवसाय", "உங்கள் தொழில்"),
  flow_2: row("Your plan", "आपका प्लान", "तुमचा प्लॅन", "உங்கள் திட்டம்"),
  flow_3: row("Your sites", "आपकी जगहें", "तुमची ठिकाणे", "உங்கள் இடங்கள்"),
  flow_4: row("Consent", "सहमति", "संमती", "ஒப்புதல்"),
  flow_5: row("Documents", "दस्तावेज़", "कागदपत्रे", "ஆவணங்கள்"),
  flow_6: row("Pay and sign", "भुगतान और साइन", "पेमेंट आणि सही", "கட்டணம் மற்றும் கையொப்பம்"),
  of_total: row("of", "में से", "पैकी", "இல்"),
  // home
  hello: row("Hello", "नमस्ते", "नमस्कार", "வணக்கம்"),
  home_new_title: row("Find the right plan for your business", "अपने बिज़नेस के लिए सही प्लान चुनें", "तुमच्या व्यवसायासाठी योग्य प्लॅन निवडा", "உங்கள் தொழிலுக்கு ஏற்ற திட்டத்தைக் கண்டறியுங்கள்"),
  home_new_sub: row("Describe it in your own words. Two minutes, no paperwork yet.", "अपने शब्दों में बताइए। दो मिनट, अभी कोई कागज़ी काम नहीं।", "तुमच्या शब्दांत सांगा. दोन मिनिटे, आत्ता कोणतीही कागदपत्रे नाहीत.", "உங்கள் வார்த்தைகளில் சொல்லுங்கள். இரண்டு நிமிடம், இப்போது ஆவணங்கள் வேண்டாம்."),
  home_get_plan: row("Get my plan", "मेरा प्लान देखें", "माझा प्लॅन पहा", "என் திட்டத்தைப் பெறுங்கள்"),
  home_continue_title: row("Pick up where you left off", "जहाँ छोड़ा था वहीं से शुरू करें", "जिथे थांबलात तिथून सुरू करा", "விட்ட இடத்திலிருந்து தொடருங்கள்"),
  home_continue_sub: row("Your plan is saved.", "आपका प्लान सेव है।", "तुमचा प्लॅन सेव्ह आहे.", "உங்கள் திட்டம் சேமிக்கப்பட்டுள்ளது."),
  home_continue: row("Continue", "आगे बढ़ें", "पुढे जा", "தொடரவும்"),
  home_order_live: row("Live", "चालू", "सुरू", "செயலில்"),
  home_track: row("Track order", "ऑर्डर ट्रैक करें", "ऑर्डर ट्रॅक करा", "ஆர்டரைக் கண்காணிக்க"),
  home_goes_live: row("Expected live", "चालू होने की तारीख", "सुरू होण्याची तारीख", "செயல்படும் தேதி"),
  home_quick: row("Quick actions", "तेज़ काम", "झटपट कामे", "விரைவு செயல்கள்"),
  home_q_advisor: row("Ask the advisor", "सलाहकार से पूछें", "सल्लागाराला विचारा", "ஆலோசகரிடம் கேளுங்கள்"),
  home_q_check: row("Check fibre", "फ़ाइबर जाँचें", "फायबर तपासा", "ஃபைபரைச் சரிபார்க்க"),
  home_q_browse: row("Browse services", "सेवाएँ देखें", "सेवा पहा", "சேவைகளைப் பார்க்க"),
  home_q_person: row("Talk to a person", "किसी व्यक्ति से बात करें", "व्यक्तीशी बोला", "ஒருவருடன் பேசுங்கள்"),
  home_check_title: row("Is fibre available at your shop?", "क्या आपकी दुकान पर फ़ाइबर उपलब्ध है?", "तुमच्या दुकानात फायबर उपलब्ध आहे का?", "உங்கள் கடையில் ஃபைபர் கிடைக்குமா?"),
  home_check_ph: row("Pincode", "पिनकोड", "पिनकोड", "அஞ்சல் குறியீடு"),
  home_check_btn: row("Check", "जाँचें", "तपासा", "சரிபார்க்க"),
  home_help_title: row("Need a person?", "किसी व्यक्ति की ज़रूरत है?", "व्यक्तीची गरज आहे का?", "ஒருவர் தேவையா?"),
  home_help_sub: row("A specialist calls you back within 2 working hours.", "विशेषज्ञ 2 कार्य-घंटों में आपको कॉल करेगा।", "तज्ञ 2 कामाच्या तासांत तुम्हाला कॉल करतील.", "நிபுணர் 2 வேலை நேரத்தில் உங்களை அழைப்பார்."),
  // welcome (signed out)
  welcome_title: row("Business internet, one clear price.", "बिज़नेस इंटरनेट, एक साफ़ कीमत।", "व्यवसायासाठी इंटरनेट, एक स्पष्ट किंमत.", "தொழிலுக்கான இணையம், ஒரே தெளிவான விலை."),
  welcome_sub: row("Tell us about your shop. Get a clear monthly price, verify on your phone, and watch the setup live.", "अपनी दुकान के बारे में बताइए। साफ़ मासिक कीमत पाइए, फ़ोन पर वेरिफाई कीजिए और सेटअप लाइव देखिए।", "तुमच्या दुकानाबद्दल सांगा. स्पष्ट मासिक किंमत मिळवा, फोनवर पडताळणी करा आणि सेटअप लाइव्ह पहा.", "உங்கள் கடையைப் பற்றி சொல்லுங்கள். தெளிவான மாத விலை, தொலைபேசியில் சரிபார்ப்பு, நேரலை அமைப்பு."),
  welcome_cta: row("Get started", "शुरू करें", "सुरू करा", "தொடங்குங்கள்"),
  welcome_have: row("I already have an account", "मेरा अकाउंट पहले से है", "माझे खाते आधीच आहे", "எனக்கு ஏற்கனவே கணக்கு உள்ளது"),
  welcome_how: row("How it works", "यह कैसे काम करता है", "हे कसे चालते", "இது எப்படி வேலை செய்கிறது"),
  welcome_s1: row("Describe your business", "अपना बिज़नेस बताइए", "तुमचा व्यवसाय सांगा", "உங்கள் தொழிலை விவரியுங்கள்"),
  welcome_s1d: row("In your language. The advisor suggests one plan with one monthly price.", "अपनी भाषा में। सलाहकार एक मासिक कीमत वाला एक प्लान सुझाता है।", "तुमच्या भाषेत. सल्लागार एका मासिक किमतीचा एक प्लॅन सुचवतो.", "உங்கள் மொழியில். ஆலோசகர் ஒரே மாத விலையில் ஒரு திட்டத்தைப் பரிந்துரைப்பார்."),
  welcome_s2: row("Verify on your phone", "फ़ोन पर वेरिफाई करें", "फोनवर पडताळणी करा", "தொலைபேசியில் சரிபார்க்கவும்"),
  welcome_s2d: row("We look up your GST and Udyam first and ask only for what is missing.", "हम पहले आपका GST और उद्यम देखते हैं और सिर्फ़ वही माँगते हैं जो कम है।", "आम्ही आधी तुमचा GST आणि उद्यम पाहतो आणि फक्त जे कमी आहे तेच मागतो.", "முதலில் உங்கள் GST மற்றும் உத்யமைப் பார்ப்போம்; குறைவானதை மட்டும் கேட்போம்."),
  welcome_s3: row("Pay, sign and track", "भुगतान, साइन और ट्रैक", "पेमेंट, सही आणि ट्रॅक", "கட்டணம், கையொப்பம், கண்காணிப்பு"),
  welcome_s3d: row("Pay securely, sign with a code, then follow the installation until it is live.", "सुरक्षित भुगतान करें, कोड से साइन करें, फिर चालू होने तक इंस्टॉलेशन देखें।", "सुरक्षित पेमेंट करा, कोडने सही करा, मग सुरू होईपर्यंत इन्स्टॉलेशन पहा.", "பாதுகாப்பாகச் செலுத்துங்கள், குறியீட்டால் கையொப்பமிடுங்கள், பின் செயல்படும் வரை கண்காணியுங்கள்."),
  welcome_example: row("An example plan from the advisor", "सलाहकार का एक उदाहरण प्लान", "सल्लागाराचा एक उदाहरण प्लॅन", "ஆலோசகரின் ஒரு எடுத்துக்காட்டு திட்டம்"),
  welcome_chat: row("Prefer chat? Message us on WhatsApp or Telegram.", "चैट पसंद है? WhatsApp या Telegram पर संदेश भेजिए।", "चॅट आवडते? WhatsApp किंवा Telegram वर संदेश पाठवा.", "அரட்டை விருப்பமா? WhatsApp அல்லது Telegram இல் செய்தி அனுப்புங்கள்."),
  qc_more: row("More tools", "और टूल", "आणखी साधने", "மேலும் கருவிகள்"),
  qc_compare: row("Compare packages", "पैकेज की तुलना", "पॅकेजची तुलना", "தொகுப்புகளை ஒப்பிடுக"),
  qc_budget: row("Set a monthly budget", "मासिक बजट तय करें", "मासिक बजेट ठरवा", "மாத பட்ஜெட்டை அமைக்கவும்"),
  qc_score: row("Your digital score", "आपका डिजिटल स्कोर", "तुमचा डिजिटल स्कोअर", "உங்கள் டிஜிட்டல் மதிப்பெண்"),
  qc_bill: row("Compare with your current bill", "अपने मौजूदा बिल से तुलना करें", "सध्याच्या बिलाशी तुलना करा", "தற்போதைய பில்லுடன் ஒப்பிடுக"),
  qc_share: row("Share with a partner or CA", "पार्टनर या CA को भेजें", "भागीदार किंवा CA ला पाठवा", "பங்குதாரர் அல்லது CA க்கு அனுப்பவும்"),
  qc_details: row("Order details", "ऑर्डर का विवरण", "ऑर्डरचा तपशील", "ஆர்டர் விவரங்கள்"),
  upd_none: row("No updates yet.", "अभी कोई अपडेट नहीं।", "अजून अपडेट नाहीत.", "இன்னும் புதுப்பிப்புகள் இல்லை."),
  pay_to_place: row("Pay and sign to place your order.", "ऑर्डर देने के लिए भुगतान और साइन करें।", "ऑर्डर देण्यासाठी पेमेंट आणि सही करा.", "ஆர்டரை உறுதி செய்ய கட்டணம் செலுத்தி கையொப்பமிடுங்கள்."),
  view_all: row("View all", "सब देखें", "सर्व पहा", "அனைத்தையும் பார்க்க"),
  // orders
  orders_title: row("Orders", "ऑर्डर", "ऑर्डर", "ஆர்டர்கள்"),
  orders_active: row("In progress", "चल रहे", "सुरू असलेले", "நடப்பில் உள்ளவை"),
  orders_done: row("Completed", "पूरे हुए", "पूर्ण झालेले", "முடிந்தவை"),
  orders_saved: row("Saved plans", "सेव किए प्लान", "सेव्ह केलेले प्लॅन", "சேமித்த திட்டங்கள்"),
  orders_empty: row("No orders yet", "अभी कोई ऑर्डर नहीं", "अजून ऑर्डर नाहीत", "இன்னும் ஆர்டர்கள் இல்லை"),
  orders_empty_sub: row("Your plans and orders will show up here as soon as you start.", "शुरू करते ही आपके प्लान और ऑर्डर यहाँ दिखेंगे।", "सुरू करताच तुमचे प्लॅन आणि ऑर्डर इथे दिसतील.", "தொடங்கியவுடன் உங்கள் திட்டங்களும் ஆர்டர்களும் இங்கே தெரியும்."),
  orders_open: row("Open", "खोलें", "उघडा", "திற"),
  order_cancelled: row("Cancelled", "रद्द", "रद्द", "ரத்து"),
  order_paid: row("Paid", "भुगतान हो गया", "पेमेंट झाले", "செலுத்தப்பட்டது"),
  order_unpaid: row("Payment due", "भुगतान बाकी", "पेमेंट बाकी", "கட்டணம் நிலுவை"),
  // sign-in and setup
  login_title: row("Sign in with your phone", "अपने फ़ोन से साइन इन करें", "तुमच्या फोनने साइन इन करा", "உங்கள் தொலைபேசியால் உள்நுழையுங்கள்"),
  login_sub: row("We send a 6-digit code by SMS. No password to remember.", "हम SMS से 6 अंकों का कोड भेजते हैं। कोई पासवर्ड याद नहीं रखना।", "आम्ही SMS ने 6 अंकी कोड पाठवतो. पासवर्ड लक्षात ठेवायची गरज नाही.", "SMS மூலம் 6 இலக்கக் குறியீட்டை அனுப்புவோம். கடவுச்சொல் நினைவில் வைக்க வேண்டாம்."),
};

export const APP_COPY = (lang: "en" | "hi" | "mr" | "ta"): Dict => {
  const out: Dict = {};
  for (const [k, v] of Object.entries(COPY)) out[k] = v[lang];
  return out;
};
