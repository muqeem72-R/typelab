/* TypeLab word list: real English words, lowercase a-z only, written for this project.
   Only words people really use: everyday life, books and stories, newspapers and the news, and programming.
   The first block is the most common words, in rough order of how often they are used (the speed tests draw
   from it). The other blocks widen the choice of letters and lengths for adaptive practice and the course.
   There are no made-up words: every word here is in an English dictionary. */
(function (root) {
  "use strict";

  // the most common words
  const COMMON = `
    the of and to in is that it was for on are as with his they at be this from have or by one had not but what all
    were when we there can an your which their said if do will each about how up out them then she many some so these
    would other into has more her two like him see time could no make than first been its who now people my made over
    did down only way find use may water long little very after words called just where most know get through back
    much before go good new write our me man too any day same right look think also around another came come work
    three word must because does part even place well such here take why help put different away again off went old
    number great tell men say small every found still between name should home big give air line set own under read
    last never us left end along while might next sound below saw something thought both few those always looked show
    large often together asked house world going want school important until form food keep children feet land side
    without boy once animals life enough took sometimes four head above kind began almost live page got earth need
    far hand high year mother light country father let night picture being study second soon story since white ever
    paper hard near sentence better best across during today however sure knew try told young sun thing whole hear
    example heard several change answer room sea against top turned learn point city play toward five using himself
    usually money seen car morning body upon family later turn move face door cut done group true leave color red
    friend begin walk ease fish mountain north base horse watch wood main plain girl usual ready list though feel
    talk bird dog direct pose song measure state product black short numeral class wind question happen complete ship
    area half rock order fire south problem piece pass farm king size hour hundred am remember step early hold west
    ground interest reach fast sing listen six table travel less ten simple vowel war lay pattern slow center love
    person serve appear road map rain rule govern pull cold notice voice fall power town fine certain fly unit lead
    cry dark machine note wait plan figure star box noun field rest correct able pound beauty drive stood contain
    front teach week final gave green oh quick develop sleep warm free minute strong special mind behind clear tail
    produce fact street inch lot nothing course stay wheel full force blue object decide surface deep moon island
    foot yet busy test record boat common gold possible plane age dry wonder laugh thousand ago ran check game shape
    yes hot miss brought heat snow bed bring sit perhaps fill east weight language among
  `;

  // real words made of only the first six letters (e t a o i n), for the very first level
  const FEWLETTERS = `
    inane titan anoint nineteen annotation intonation tenet taint iota intone alas tenant
  `;

  // daily life: home, family, food, body, health, weather, animals, time, travel, money, school, work, hobbies
  const DAILY = `
    kitchen bedroom bathroom garden garage window floor ceiling wall roof stairs balcony hallway basement chair sofa
    couch pillow blanket sheet mattress curtain carpet lamp mirror shelf cupboard drawer closet cabinet desk bench
    stool fridge freezer oven stove kettle toaster blender heater fan vacuum broom bucket sponge soap towel basin
    sink shower bathtub tissue brush comb razor shampoo toothbrush toothpaste laundry iron hanger basket bottle jar
    bowl plate cup mug glass spoon fork knife tray pan pot lid bag sack wallet purse key lock keys phone mobile
    charger cable battery screen remote clock alarm candle matches blade needle thread button zipper pocket sleeve
    collar shirt trousers pants jeans shorts skirt dress jacket coat sweater sweatshirt hoodie scarf gloves socks
    shoes sandals slippers boots sneakers cap hat belt tie suit uniform apron pajamas parents brother sister sibling
    son daughter child baby kid grandmother grandfather grandparents uncle aunt cousin nephew niece husband wife
    spouse partner relative neighbor guest visitor stranger woman teenager adult elder teacher student doctor nurse
    driver farmer cook baker butcher tailor barber painter carpenter plumber electrician mechanic engineer lawyer
    judge officer soldier pilot sailor captain manager clerk cashier worker bread butter cheese milk yogurt cream egg
    eggs rice wheat flour sugar salt pepper spice honey jam oil vinegar sauce soup salad sandwich burger pizza pasta
    noodles curry lentils beans peas corn potato tomato onion garlic ginger carrot cabbage cauliflower spinach
    lettuce cucumber pumpkin mushroom chili radish turnip apple banana orange mango grape lemon lime peach pear plum
    cherry berry strawberry melon watermelon pineapple coconut papaya guava apricot raisin almond cashew peanut
    walnut pistachio chicken mutton beef pork shrimp lamb sausage bacon breakfast lunch dinner supper snack dessert
    cake cookie biscuit chocolate candy sweet coffee tea juice soda lemonade smoothie meal menu recipe ingredient
    dish taste flavor fresh frozen boil fry bake roast grill steam chop slice stir mix pour peel wash restaurant cafe
    canteen bakery market grocery vegetable fruit hair forehead eye eyes eyebrow ear nose cheek mouth lip tongue
    tooth teeth chin neck throat shoulder arm elbow wrist finger thumb palm nail chest spine belly stomach waist hip
    leg knee ankle toe heel skin bone muscle blood heart lung brain kidney liver breath dream health healthy sick
    illness disease fever cough flu headache stomachache pain injury wound bruise bandage medicine tablet pill
    capsule syrup injection vaccine hospital clinic pharmacy patient ambulance emergency surgery exercise yoga jog
    run swim stretch diet vitamin protein calcium fitness weak tired recover heal treatment therapy checkup symptom
    allergy infection weather sunny cloudy rainy windy stormy snowy foggy humid cool freezing temperature sunshine
    sunrise sunset moonlight sky cloud drizzle thunder lightning storm breeze hurricane frost ice hail fog mist dew
    rainbow season spring summer autumn winter monsoon harvest flood drought earthquake hill valley river lake pond
    stream waterfall ocean beach coast shore forest jungle desert meadow tree leaf branch root flower rose lily
    jasmine grass bush seed soil stone sand mud puppy cat kitten cow bull buffalo goat sheep pig hen rooster duck
    goose pigeon parrot sparrow crow eagle owl peacock whale dolphin shark turtle frog snake lizard crocodile lion
    tiger leopard elephant monkey bear wolf fox deer rabbit squirrel mouse camel donkey zebra giraffe kangaroo
    butterfly bee ant spider mosquito beetle worm noon afternoon evening midnight tomorrow yesterday tonight weekend
    weekday month decade century monday tuesday wednesday thursday friday saturday sunday january february march
    april june july august september october november december birthday holiday festival vacation calendar schedule
    late daily weekly monthly yearly trip journey tour airport flight airline passenger luggage suitcase ticket
    passport visa boarding station platform train railway track bus route avenue lane highway bridge tunnel signal
    traffic junction crossing parking taxi truck bike bicycle scooter motorcycle helmet engine fuel petrol diesel
    tyre brake horn direction straight hotel hostel booking reservation reception tourist guide camp tent resort
    museum temple church mosque palace fort zoo park monument shop store mall supermarket customer seller buyer price
    cost cheap expensive discount sale offer bargain receipt bill invoice payment cash coin credit debit card account
    balance bank deposit withdraw loan saving savings budget tax salary wage income expense profit loss rent
    insurance cart checkout counter delivery parcel package refund exchange quality brand fashion clothing jewelry
    silver college university campus classroom professor lecturer pupil lesson subject syllabus exam quiz marks grade
    result degree diploma certificate library laboratory homework assignment project report essay notes notebook
    textbook pencil pen eraser ruler marker chalk blackboard whiteboard timetable admission scholarship science math
    mathematics physics chemistry biology history geography english hindi grammar vocabulary reading writing speaking
    listening spelling alphabet paragraph office meeting email letter message call interview resume promotion career
    profession business company team employee colleague client deadline presentation sport cricket football soccer
    tennis badminton hockey basketball volleyball chess golf race runner swimmer player coach match score goal win
    lose draw tournament champion trophy medal music singer dance dancer guitar piano drum violin flute film movie
    cinema theater actor actress director series episode comedy drama cartoon photo camera video painting drawing
    sketch craft cooking gardening fishing hiking cycling puzzle toy
  `;

  // books and stories: fiction, poetry, writing and the words authors love
  const BOOKS = `
    book novel tale fable legend myth poem poetry verse rhyme author writer poet novelist editor publisher chapter
    title cover volume reader narrative plot character hero heroine villain protagonist theme setting scene dialogue
    conflict climax ending beginning prologue epilogue memoir biography autobiography diary journal article review
    fiction fantasy mystery thriller romance adventure horror tragedy classic literature manuscript draft edition
    printed paperback hardcover bookmark bookstore kingdom queen prince princess knight castle dragon wizard witch
    fairy giant ghost spirit sword shield crown throne village voyage quest treasure secret prophecy destiny courage
    honor loyalty betrayal sacrifice freedom justice revenge forgiveness wisdom ancient gentle fierce silent distant
    mysterious beautiful peaceful shadow whisper wander gaze glimpse tremble triumph sorrow solitude grief despair
    hope longing memory harmony twilight dusk dawn horizon orchard cottage lantern candlelight moonlit starry gloomy
    radiant graceful humble noble brave clever curious eager faithful generous honest jealous kindly lonely modest
    proud restless sincere stubborn tender weary wicked wise tall heavy bright pale golden crimson scarlet emerald
    azure ivory amber violet indigo marble velvet silk lace crystal feather thorn petal blossom bloom garland wreath
    brook creek cliff canyon cave ruins tower dungeon chamber corridor courtyard gate gateway sail anchor harbor
    lighthouse compass crew pirate traveler wanderer merchant peasant shepherd hunter fisherman blacksmith miller
    weaver scholar monk priest bishop servant maid butler guard general army battle victory defeat siege fortress
    empire emperor rebel revolt rhythm melody lyric chorus ballad hymn anthem sonnet haiku stanza couplet metaphor
    simile symbol irony satire allegory narrator dialect proverb phrase idiom quote quotation excerpt passage
    footnote glossary index appendix preface foreword introduction contents summary abstract thesis argument evidence
    conclusion analysis critic criticism interpretation philosophy logic ethics morality virtue vice reason emotion
    passion desire fear anger joy happiness sadness loneliness friendship kindness hatred trust doubt belief faith
    truth lie mistake regret forget imagine believe discover explore escape return arrive depart follow protect
    rescue defend fight struggle survive endure suffer mourn celebrate cherish admire adore envy blame forgive
    apologize promise swear vow pledge confess reveal conceal hide seek search gain earn deserve inherit
  `;

  // newspapers: government, law, economy, business, science, world affairs and sport
  const NEWS = `
    news newspaper headline reporter journalist column editorial opinion breaking update announce announcement
    statement spokesperson government minister president premier parliament assembly senate congress policy law act
    reform constitution amendment court verdict trial appeal attorney police crime arrest investigation victim
    witness suspect prison election vote voter ballot campaign candidate party leader opposition majority minority
    coalition debate protest rally strike union demand petition economy economic stock shares trade export import
    inflation growth recession deficit revenue industry factory manufacturing corporation startup investor investment
    merger currency gas energy electricity solar nuclear climate environment pollution emission carbon wildlife
    conservation disaster wildfire relief aid epidemic pandemic outbreak research scientist discovery experiment
    space satellite rocket mission technology digital internet online software artificial intelligence robot data
    security privacy education literacy enrollment league international foreign domestic border treaty summit
    diplomat ambassador sanction peace ceasefire refugee migration population census survey poll percent million
    billion trillion average median increase decrease decline surge rise drop jump climb announced approved rejected
    confirmed denied reported claimed warned urged demanded proposed passed signed launched released revealed
    published introduced suspended arrested charged convicted acquitted appointed elected resigned replaced extended
    postponed cancelled delayed completed established agency authority commission committee council board panel
    department ministry bureau official spokesman municipal federal national regional local central provincial
    district capital rural urban metro transport infrastructure housing construction development scheme program
    subsidy pension healthcare welfare poverty unemployment employment jobs wages workers labour farmers agriculture
    crops irrigation rainfall fertilizer grain rupee dollar euro yen crude barrel stocks bonds fund mutual portfolio
    dividend quarter annual forecast outlook target estimate expected analysts experts critics supporters opponents
    residents citizens voters members officials leaders ministers lawmakers authorities investigators negotiations
    talks agreement deal contract proposal strategy measures restrictions regulations rules guidelines standards
    safety inspection audit compliance penalty ban ruling warning alert evacuation shelter damage injured missing
    survivors crews firefighters volunteers ceremony award prize honour tribute anniversary memorial exhibition
    concert premiere release semifinal squad lineup innings wicket boundary goalkeeper striker defender midfielder
    referee stadium crowd fans
  `;

  // programming and computers
  const CODE = `
    programmer programming code coding developer hardware computer laptop keyboard monitor display server network
    router website webpage browser application system database query schema backup storage cache disk file folder
    directory path document text binary buffer input output print console terminal command shell script function
    method instance property attribute variable constant parameter value type string integer float boolean array
    stack queue graph hash pair loop iterate condition switch case break continue throw catch error exception debug
    debugger bug fix patch mock assert coverage compile compiler interpreter runtime framework module dependency
    version build deploy deployment pipeline container host domain request response header session token login
    password encrypt decrypt secure authentication permission role user admin profile config settings production
    staging commit repository merge push clone issue sprint agile scrum algorithm sort filter reduce recursion
    complexity optimize performance latency process async await callback event listener handler trigger socket port
    protocol http https json xml html css javascript python java ruby swift kotlin rust golang typescript sql nosql
    api endpoint webhook validate parse serialize format template component render props hook redirect middleware
    controller model view layout style responsive animation canvas pixel vector font icon image syntax semantic
    keyword operator operand expression block scope closure lambda generic interface override overload constructor
    destructor pointer reference heap garbage allocate leak overflow underflow bitwise byte bit decimal hexadecimal
    octal ascii unicode encoding charset locale timezone timestamp epoch interval timeout delay retry fallback job
    cron batch log logger trace metric dashboard chart upload download proxy firewall encryption signature checksum
    digest nonce cipher random generate unique identifier uuid slug param fragment link tag element node selector
    margin padding width height flex grid position absolute fixed sticky scroll zoom opacity gradient transition
    transform rotate scale translate keyframe media breakpoint viewport desktop device sensor microphone speaker
    touch gesture drag click hover focus blur submit reset cancel confirm dialog modal popup tooltip navbar sidebar
    footer checkbox radio dropdown slider toggle tab item row cell label placeholder validation required optional
    default custom global private public protected static virtual native external internal legacy modern stable beta
    alpha nightly minor major changelog readme license contributor maintainer milestone approve reject squash rebase
    stash diff ignore workflow action artifact docker compose cluster pod service ingress namespace helm terraform
    ansible linux ubuntu windows macos android ios kernel firmware bios boot shutdown restart install uninstall
    upgrade downgrade configure setup initialize start stop pause
  `;

  // everyday verbs, adjectives and nouns that fill the pages of books and papers
  const GENERAL = `
    accept achieve acquire adapt address adjust admit adopt advance advice affect afford agenda agree ahead aim alike
    allow alone already alter although altogether amount angle anxious anybody anyone anything anyway anywhere apart
    appetite apply appoint approach arrange artist ashamed aside asleep aspect assess assist associate assume assure
    atmosphere attach attack attempt attend attention attitude attract audience avoid aware awful background banner
    barely basic basis become behave behavior belong benefit besides beyond bitter blank blind bless boast borrow
    bother bottom bounce breadth breathe brief brilliant broad broken bundle burden burn cabin calculate calm capable
    capacity capture careful careless carry casual cause caution challenge chance channel charge charity charm
    cheerful chief choice choose circumstance citizen civil claim clean close collapse collect combine comfort
    comment communicate community compare compete complain complex concern conclude conduct confidence confuse
    connect conscious consider consist construct consult consume contact content contest context contrast control
    convenient conversation convince cooperate copy count crash crazy create creature crisis critical crucial culture
    current danger dare decent declare decorate define deliberate delicate deliver democracy depend depth describe
    design destroy detail detect determine devote diagram difference difficult dimension disagree disappear
    discipline discuss distance distinct distribute disturb divide divorce dominate double dramatic drift due duty
    earnest easily edge edit educate effect effort elaborate elderly elect eliminate embarrass emerge emphasis employ
    empty enable encounter encourage enemy engage enjoy enormous ensure enter entire entrance equal equip essential
    establish evaluate eventually evolve exact examine excellent except excite exclude excuse execute exhaust exhibit
    exist expand expect experience expert explain explode express extend extra extreme fabric facility factor fade
    failure faint fair familiar famous fancy fantastic fasten fault favor feature feeling fellow fence finance
    finding finish firm flash flexible forbid forever formal former fortune forward foundation frame frequent
    friendly frighten fundamental funny furniture further future gallery gather genius genuine glance glory grace
    gradual grand grant grateful grave greet guarantee guess guidance guilty habit handle hardly harm heaven helpful
    hesitate highlight hint historic hobby hostile household human humor hunger hurry hurt hypothesis ideal identify
    identity illustrate immediate immense impact implement imply importance impose impossible impress improve
    incident include indeed independent indicate individual infant influence inform initial inner innocent insect
    insist inspire instant instead instruct intelligent intend intense interfere interpret interrupt introduce invent
    invest invite involve isolate jewel judgment junior junk jury justify keen knowledge labor lack landscape laser
    latest launch lawn layer lecture legal leisure length level liberty lifetime limit linear liquid literary lively
    locate loose lovely loyal luck luxury magazine magic mainly maintain manage manner manual manufacture marine
    marriage master material matter maximum meaning medical medium member mental mention mercy merely merit metal
    middle military mineral minimum miracle miserable mixture moderate moment mood moral moreover mortgage motion
    motive mount movement multiple narrow nation natural nature navy nearby neat necessary neglect negative neither
    nervous neutral nevertheless nobody noise normal notion nowhere numerous obey observe obtain obvious occasion
    occupy occur offend operate oppose opposite option orbit ordinary organize origin original otherwise outcome
    outdoor outer outside overall overcome overseas owner pace parade parallel parent partial participate particular
    peak peculiar perfect perform period permanent permit personal persuade phase physical pitch pity planet plastic
    pleasant please plenty polite polish popular portion positive possess practical practice praise precious precise
    predict prefer pregnant prepare presence present preserve press pressure pretend pretty prevent previous pride
    primary prime principal principle prior priority probably procedure proceed progress promote prompt proof proper
    proportion propose prospect prove provide publish punish purchase pure purpose pursue quantity quiet quite raise
    range rapid rare rate rather react real realize recall receive recent recognize recommend refer reflect refuse
    regard region register regular relate relax relevant religion remain remark remind remove repair repeat replace
    reply represent reputation require reserve resident resist resolve resource respect respond retire reverse reward
    ridiculous risk rival romantic rough round routine royal rubber rush sample satisfy save scarce scatter scratch
    section select senior sense sensible separate serious settle severe shake shallow shame share sharp shift shine
    shock shoot shopping shortage shout shrink sight similar single situation skill slight slogan slope smart smooth
    society solid solution solve somebody somehow someone somewhere sophisticated source spare speak species specific
    speech speed spell spend split spoil sponsor spread square staff stage stair stake stamp standard status steady
    steal steep steer stick stiff strange strength stress strict structure studio stuff substance substitute succeed
    success sudden sufficient suggest suitable superior supply support suppose supreme surgeon surplus surprise
    surround sustain swallow sympathy tackle talent task technical technique temper temporary tendency tense term
    terrible territory theory therefore thick thin thorough threat throughout thus tight timber timid tiny toast
    tolerate tone tool topic total tough tradition tragic trail transfer trap treat tremendous trend tribe trick
    troop trouble twice typical ultimate unable uncertain undergo understand undertake unemployed unexpected
    unfortunately unite universe unless unlike unlikely unusual upper upset urge urgent utility vague valid valuable
    variety various vast vehicle venture vertical vessel veteran violence violent visible vision visit visual vital
    vivid voluntary wake warn waste wave wealth weapon welcome western whatever whenever whereas whether whichever
    whom whose widely wild willing wish within wooden worry worth wrap written wrong yard yellow yield youth zone
  `;

  // short common words, so that a few unlocked letters still make real words
  const SHORT = `
    tin ton net eat ate tan ion eon oat tot nine tint notation eaten attain innate antenna intent atone onto notate
    annotate intention teen tattoo nettle sat sin sees seat eats sent tens tons tins ants noises stones nests stain
    satin tease tension sensation thank hate hello shall shoe shot shade easy era ere rear reed reel rein ride rope
    rat rod rot rage raid rail rack ring rink riot ripe dad dam den die dig dim din dip dirt dive dock doll dose dot
    dove drew lad lag lazy lean leap lend lest lick lift load loft lord lost loud low lump cab cage cane care cast
    cent chat cheer chef chip clap clay clip cloth club coal coil cone cope cord core cot cozy crab crane crawl crib
    crop cross cruel crush cub cube cue cuff cure curl curve cute curb cult cunning used uses dune duet dull dump
    dust mule mum mute mad male mark mask mass mat mate mean meat melt mess mild mill mine mint mob moan mode mole
    mom moth motor wax wear web wed wet wide wine wing wink wipe wire wit wool worn wren fun fur fat fed fee feed
    fell felt fern fib fig fist fit flag flame flap flat flaw flea fled flip flock flow foam foil fold folk fond fool
    foul fuse fuss gone grab gravy grew grey grin grip grow gum gun gut guy pad paid pail paint past pat pay pea pet
    pick pie pile pin pine pink pipe pit plant plus pole pony pool poor pop post pray pro pub pump pup bad ball band
    bar bark barn bat bath bead beam bean beat beer beg bell bend bent bet bid bin bite blast blaze bleed blend blink
    blow bold bolt bond boom born boss brass brick bride broke brown bubble buck bud bulb bump bunch burst buy buzz
    vain van vase vat vet vest vine kiss kit kite knit knob knock knot jab jack jade jail jaw jazz jelly jet jig join
    joke jolly jug exit matrix quit quilt quarrel zip zero zest seize freeze dozen fuzzy fizz maze haze
  `;

  // more of everyday life, school subjects, computers, nature and manner words
  const MORE = `
    hammer screwdriver wrench pliers drill screw nut axe shovel rake ladder chain tank valve gauge meter tape glue
    roller cement tile plank pillar hinge plug tube circuit heritage equality cooperation honesty patience happy sad
    angry afraid excited bored hopeful confident shy rude ask drink kick meet open sell send smile stand worse worst
    huge stale dirty soft blunt sour salty spicy rich safe dangerous atom molecule gravity velocity density magnet
    voltage galaxy comet asteroid telescope microscope organ organism evolution gene genetic bacteria virus fungus
    mammal reptile fossil formula equation observation measurement vendor supplier retailer wholesale warehouse
    inventory shipment logistics freight cargo tariff customs registration archive filing division headquarters art
    sculpture portrait theatre rehearsal applause orchestra album lyrics television broadcast programme documentary
    printing poster idea concept chaos decision opportunity suburb neighborhood downtown pavement sidewalk lamppost
    signboard billboard fountain statue skyline apartment building elevator staircase lobby attic rooftop sharpener
    stapler envelope postcard courier mailbox letterbox bracelet necklace earring umbrella raincoat backpack
    briefcase handbag sunglasses spectacles cello trumpet saxophone harmonica tambourine lychee pomegranate tangerine
    avocado blueberry raspberry cranberry cardamom cinnamon turmeric coriander cumin mustard saffron basil parsley
    thyme oregano rosemary yoghurt margarine pancake waffle omelette cereal oatmeal porridge muffin pastry pudding
    custard murmur mumble gossip chatter discussion complaint apology greeting goodbye thanks sorry pardon midday
    daybreak nightfall third fourth fifth sixth seventh eighth ninth tenth triple couple northern southern eastern
    coastal inland tropical arctic polar nursery kindergarten secondary graduate undergraduate seminar tutorial
    workshop training coaching mentor trainee intern apprentice volunteer wedding funeral picnic barbecue carnival
    fireworks celebration tricycle skateboard skate wheelchair stroller trolley sneeze yawn hiccup shiver blush frown
    giggle sob sigh puddle pebble boulder glacier volcano lava crater peninsula plateau prairie wetland swamp lagoon
    reef cuckoo woodpecker kingfisher flamingo penguin ostrich vulture falcon hawk bumblebee dragonfly grasshopper
    firefly caterpillar cocoon oak maple willow bamboo banyan cedar cypress birch hamster guinea llama alpaca printer
    scanner headphone webcam modem adapter browse swipe tap paste undo redo inbox outbox attachment spam reminder
    notification username avatar subscribe homepage hosting wireless bluetooth bugfix refactor benchmark frontend
    backend fullstack accessibility arithmetic algebra geometry calculus statistics probability fraction percentage
    ratio addition subtraction multiplication triangle rectangle circle diameter radius perimeter sphere cylinder
    pyramid perpendicular horizontal diagonal magnetism radiation spectrum frequency amplitude vibration reflection
    refraction compound reaction acid alkali oxygen hydrogen nitrogen sodium copper photosynthesis respiration
    digestion circulation reproduction inheritance ecosystem habitat continent province latitude longitude equator
    hemisphere dynasty revolution independence monarchy republic colony economics consumer producer taxation numeracy
    creativity imagination curiosity motivation reliable diligent punctual thoughtful respectful wonderful terrific
    marvelous splendid magnificent delightful charming horrible dreadful tedious boring annoying frustrating
    meanwhile afterwards immediately suddenly gradually recently currently previously quickly slowly carefully
    carelessly quietly loudly gently firmly clearly simply happily sadly bravely furthermore beneath beside
  `;

  // words made only of the home-row letters, for the first lessons of the course
  const HOMEROW = `
    ad ads add adds dad dads fad fads sad sass lad lads lass salsa flask flasks fall falls asks alfalfa
  `;

  const split = (s) => s.split(/\s+/).filter(Boolean);
  const seen = new Set();
  const words = [COMMON, FEWLETTERS, DAILY, BOOKS, NEWS, CODE, GENERAL, SHORT, MORE, HOMEROW].flatMap(split).filter((w) => {
    if (seen.has(w) || !/^[a-z]+$/.test(w)) return false;
    seen.add(w);
    return true;
  });
  const common = split(COMMON);

  const api = { words, common };
  if (typeof module === "object" && module.exports) module.exports = api;
  else ((root.TL = root.TL || {}).data = root.TL.data || {}).words = api;
})(typeof window !== "undefined" ? window : globalThis);
