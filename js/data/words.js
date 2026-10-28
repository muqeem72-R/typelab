/* TypeLab word list: plain English words written for this project, lowercase a-z only.
   The first block is the most common words (used by the speed tests); the rest widens
   the choice of letters and lengths for adaptive practice and the course. */
(function (root) {
  "use strict";

  const COMMON = `
    the of and to in is that it was for on are as with his they at be this from have or by one had not but what
    all were when we there can an your which their said if do will each about how up out them then she many some
    so these would other into has more her two like him see time could no make than first been its who now people
    my made over did down only way find use may water long little very after words called just where most know get
    through back much before go good new write our me man too any day same right look think also around another came
    come work three word must because does part even place well such here take why help put different away again off
    went old number great tell men say small every found still between name should home big give air line set own
    under read last never us left end along while might next sound below saw something thought both few those always
    looked show large often together asked house world going want school important until form food keep children feet
    land side without boy once animals life enough took sometimes four head above kind began almost live page got
    earth need far hand high year mother light country father let night picture being study second soon story since
    white ever paper hard near sentence better best across during today however sure knew try told young sun thing
    whole hear example heard several change answer room sea against top turned learn point city play toward five using
    himself usually money seen car morning body upon family later turn move face door cut done group true leave color
    red friend begin walk ease fish mountain north once base hear horse cut sure watch color face wood main enough plain
    girl usual young ready above ever red list though feel talk bird soon body dog family direct pose leave song
    measure state product black short numeral class wind question happen complete ship area half rock order fire south
    problem piece told knew pass farm top whole king size heard best hour better true during hundred am remember step
    early hold west ground interest reach fast five sing listen six table travel less morning ten simple several
    vowel toward war lay against pattern slow center love person money serve appear road map rain rule govern pull
    cold notice voice fall power town fine certain fly unit lead cry dark machine note wait plan figure star box noun
    field rest correct able pound done beauty drive stood contain front teach week final gave green oh quick develop
    sleep warm free minute strong special mind behind clear tail produce fact street inch lot nothing course stay
    wheel full force blue object decide surface deep moon island foot yet busy test record boat common gold possible
    plane age dry wonder laugh thousand ago ran check game shape yes hot miss brought heat snow bed bring sit perhaps
    fill east weight language among
  `;

  const MORE = `
    tea ten tie tin ton toe not net nit ant eat ate one tan tat ion eon oat tot tit nine tone tent tint tine note
    noon neat nation notation attention onion tonne taint eaten attain tenet innate ante antenna intent atone aeon
    oaten nonet intone iota anent
    ask add all fall flask salad glad gas gash has had hall lash lass sad dad fad lad flag flags falls halls shall
    alas alfalfa dahlia gaff gall hag hash haha lag lags slash slag sash shad shag dash daft fast last list silk
    desk disk dish fish flash flesh fresh shelf shell sell self sale slide slid slim slip slow slot sled said sail
    side sigh sign sing sink sip sir sit six skin skip sky sleep small smart smell smile smoke snow soft soil some
    jam jar jaw jet jig job jog jot joy jug jump jack jade jail jazz jeans jelly jewel joint joke jolly journey
    judge juice jungle junior just justice kangaroo keen keep kept kettle key kick kid kill kind king
    kiss kit kitchen kite kitten knee kneel knew knife knit knock knot know known label lack lad ladder lady lake
    lamb lamp lane lap lark laser late laugh lawn lazy leaf lean leap learn least leather leg lemon lend length
    lens less lesson letter level lid lift lip lock log lone lonely look loop lord lose loss lost loud lunch
    quack quail quake quality quarter queen queer quest question quick quiet quilt quit quite quiz quota quote
    box fax fix fox hex mix next oxen six tax text tux wax exam exact excel excuse exit expect expert extra exist
    zero zest zone zoo zoom zip zinc size maze lazy dozen crazy fizz buzz blaze freeze breeze squeeze seize
    vacant vague valid valley value van vase vast vault vegetable velvet verb verse very vest veto view village
    vine violet visit vital vivid voice volume vote vowel voyage wage wagon waist wait wake walk wall walnut want
    warm warn wash wasp waste watch wave wax weak wealth weapon wear weather web wedding week weep weigh welcome
    west whale wheat wheel whisper whistle width wife wild will win wind window wing winter wipe wire wise wish
    witch wolf woman wonder wood wool worm worry worth wrap wrist write wrong yard yarn yawn year yell yellow
    yes yet yield young youth yummy zebra
    able about above accept account across act action active actor add admit adult advice afraid after again age
    agree ahead air alarm album alive allow alone along also always amount angle angry animal ankle answer any
    apart apple april area arm army around arrive art ask asleep atom attack aunt autumn avoid awake away baby
    back bad bag bake ball banana band bank bar base basic basket bath battle beach bean bear beat beautiful
    because bed bee beef beer before begin behind bell belong belt bench bend beside best better between beyond
    bicycle big bill bird birth bit bite bitter black blade blame blank blind block blood blow blue board boat
    body boil bone book boot border born both bottle bottom bowl brain branch brave bread break breath brick
    bridge brief bright bring broad broken brother brown brush bubble bucket build bunch burn burst bus busy
    butter button buy cable cage cake call calm camera camp can candle candy cap capital captain car card care
    carry case cash castle cat catch cause cave ceiling cell cent center chain chair chalk chance change charge
    chase cheap check cheek cheese chest chicken chief child chin choice choose church circle city class clay
    clean clear clever click climb clock close cloth cloud club coach coal coast coat coffee coin cold collect
    color comb comfort common compare complete cook cool copy corn corner cost cotton couch cough count country
    couple courage cousin cover crack craft crash cream creek crew crop cross crowd crown cry cup curl curtain
    curve daily damp dance danger dare dark date dawn dead deal dear death debt decide deep deer delay delight
    desert detail dial diamond diary dice die diet dig dinner dirt dirty discover dish dive doctor dog doll
    dollar door double doubt dough down dozen drag draw dream dress drink drip drive drop drum dry duck dust
    duty eager eagle ear early earn earth east easy edge egg eight either elbow elder electric elephant else
    empty end enemy energy engine enjoy enough enter entire equal error escape even evening event every evil
    exchange excite expect explain eye face fact fail fair faith false fame fancy far farm farmer fashion fast
    fat fault fear feast feather feed feel fence fever few field fight figure fill film final find fine finger
    finish fire firm first fit flame flat flight float flood floor flour flow flower fly fog fold follow fond
    food fool foot force forest forget fork form fort forward frame free fresh friend frog front frost fruit
    fuel full fun funny fur future gain game gap garage garden gate gather gear gentle giant gift girl glass
    globe glove glow glue goat gold good grain grand grape grass grave gray great green greet grew grey grip
    ground group grow guard guess guest guide guitar habit hair half hall hammer hand handle happen happy harbor
    hard harm hat hate hawk head health heap hear heart heat heavy heel height hello help hen herd hero hide
    high hill hint hip hire history hit hobby hold hole holiday hollow holy home honest honey hood hook hope
    horn horse hospital host hot hotel hour house huge human humble hundred hungry hunt hurry hurt husband ice
    idea idle image inch income insect inside instead iron island issue itch item ivory jacket
    lab labor lack lawyer layer lead league leave lecture legal lemon level library license lie life lift
    light like limit line link lion liquid list listen little live load loan local lock lonely long loose
    lovely low lucky lumber machine mad magic mail main major make male mall manage manner many map marble
    march mark market marry mask mass master match mate material math matter maybe meal mean measure meat
    medal medicine meet melt member memory mend mention menu mercy merry message metal method middle might mild
    mile milk mill mind mine minor minute mirror miss mist mistake mix model modern moment money monkey month
    mood moon moral more morning mother motion motor mountain mouse mouth move movie much mud music must mystery
    nail naked name narrow nation nature navy near neat neck need needle neighbor neither nerve nest net never
    new news nice night noble nobody noise none noon normal north nose note nothing notice novel now number nurse
    nut oak obey object ocean odd offer office officer often oil old once onion open opinion orange order
    ordinary organ other ought outdoor outside oval oven over owe own owner pack page pain paint pair palace
    pale palm pan paper parade parent park part party pass past paste path patient pause pay peace peach pear
    pearl pen pencil people pepper perfect period person pet phone photo piano pick picnic picture pie piece
    pig pile pill pillow pilot pin pine pink pipe pitch pity place plain plan plane plant plastic plate play
    please plenty plot plow plug plus pocket poem poet point poison pole police polite pond pony pool poor
    popular port post pot potato pound pour powder power praise pray prefer present press pretty price pride
    prince print prison prize problem produce promise proof proper protect proud prove public pull pump punch
    pupil puppy pure purple purpose push puzzle rabbit race radio rail rain raise range rapid rare rate rather
    raw reach read ready real reason receive record red reduce reflect refuse region relax remain remember
    remove repair repeat reply report rest result return reward rhythm rice rich ride right ring rise risk
    river road roast robot rock roll roof room root rope rose rough round route row royal rub rubber rude rug
    rule run rush rust sack sad safe sail salad sale salt same sand save saw say scale scare scene school
    science score scrap screen sea search season seat second secret see seed seem seldom sell send sense serve
    seven several shade shadow shake shape share sharp sheep sheet shelf shell shine ship shirt shoe shoot shop
    shore short shoulder shout show shower shut shy sick side sight silent silk silly silver simple since sing
    single sink sister site six size skill skin skirt sky slave sleep slice slide slight slip slow small smart
    smell smile smoke smooth snake snow soap sock soft soil soldier solid solve some son song soon sore sorry
    sort soul sound soup sour south space spare speak special speech speed spell spend spice spider spin spirit
    spit split spoil sport spot spread spring square stable staff stage stair stamp stand star start state
    station stay steady steal steam steel steep step stick stiff still sting stir stock stomach stone stop
    store storm story stove straight strange stream street stretch strike string strip strong student study
    stuff stupid style subject such sudden sugar suit summer sun supper supply support sure surface surprise
    swallow swamp swear sweat sweep sweet swim swing switch sword symbol system table tail take tale talk tall
    tank tape target taste tax teach team tear tell ten tennis tent term test thank theater theme theory thick
    thief thin thing think third thirst thorn thought thread threat three throat throw thumb thunder ticket
    tide tidy tie tiger tight till time tin tiny tip tire title toast today toe together toilet tomato tone
    tongue tool tooth top total touch tough tour toward towel tower town toy trace track trade traffic train
    trap travel tray treat tree trial trick trip trouble truck true trust truth try tube tune turn twice twin
    twist type ugly uncle under unit unite until upper upset use useful usual valley
  `;

  const split = (s) => s.split(/\s+/).filter(Boolean);
  const seen = new Set();
  const words = [...split(COMMON), ...split(MORE)].filter((w) => {
    if (seen.has(w) || !/^[a-z]+$/.test(w)) return false;
    seen.add(w);
    return true;
  });
  const common = words.slice(0, split(COMMON).length);

  const api = { words, common };
  if (typeof module === "object" && module.exports) module.exports = api;
  else ((root.TL = root.TL || {}).data = root.TL.data || {}).words = api;
})(typeof window !== "undefined" ? window : globalThis);
