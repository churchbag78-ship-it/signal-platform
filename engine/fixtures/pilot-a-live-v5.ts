/**
 * Pilot A LIVE v5 — 2026-09-09, first-party sweep and change-family discovery.
 *
 * WHAT CHANGED FROM v3: only the QUERIES. The engine generated a plan of 66
 * queries — a mandatory first-party sweep (newsroom, press releases, projects)
 * on every domain each company is known to own, then six change-family queries
 * per company, strong families first. The agent executed them verbatim through
 * its WebSearch tool and captured the results below. The agent chose nothing
 * about what was searched.
 *
 * The v3 capture ran two fixed template queries per company. Everything
 * downstream — identity gate, source classification, verification, polarity,
 * epistemic levels — is unchanged, which is what makes the comparison mean
 * something.
 *
 * DATES: a claim carries a date only where a source states one. Where a v5
 * source is the same URL a v3 capture already dated, that date is carried
 * across and marked; nothing is inferred from a URL path or a crawl date.
 *
 * Page retrieval remains blocked by the egress policy, so every claim here is
 * at `search_snippet` level.
 */

import type { Hypothesis, Inference } from '../src/domain.ts';
import type { CaptureFile } from '../src/research/agent-bridge.ts';
import type { ExtractionCorpus } from '../src/research/corpus.ts';
import type { ExtractedClaim } from '../src/research/extraction.ts';
import type { ClaimTopic } from '../src/research/registry.ts';

const UK = 'United Kingdom';

export const liveCaptureV5: CaptureFile = {
  "capturedAt": "2026-09-09",
  "transport": "agent WebSearch tool (engine-generated queries executed verbatim)",
  "captures": [
    {
      "query": "site:maeving.com news",
      "results": [
        {
          "title": "Maeving | News",
          "url": "https://us.maeving.com/blogs/news",
          "snippet": "Maeving news index: new electric motorcycles RM1S Blackout and RM2 were launched in 2025, and Motorcycle News named the RM1S 'Electric Bike of the Year'.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Maeving 2025 Look Back, 2026 Ahead",
          "url": "https://maeving.com/en-us/blogs/news/maeving-2025-look-back-2026-ahead",
          "snippet": "Maeving launched the RM1S Blackout and RM2 in 2025 and MCN named the RM1S Electric Bike of the Year after it took Best Urban Electric Bike in 2024.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:maeving.com press release announcement",
      "results": [
        {
          "title": "Maeving in 2023: A Year To Remember",
          "url": "https://maeving.com/en-us/blogs/news/maeving-in-2023-a-year-to-remember",
          "snippet": "Maeving's own year in review describes the new factory and headquarters move in December 2023.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Partnerships",
          "url": "https://maeving.com/en-us/pages/partnerships",
          "snippet": "Maeving partnerships page with contact details for partnership queries.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:maeving.com projects contract",
      "results": [
        {
          "title": "Maeving Tender",
          "url": "https://maeving.com/pages/maeving-tender",
          "snippet": "Maeving Ltd tender dated 23 November 2023 seeking contractors to carry out refurbishment work for its premises in Coventry, including renovation of a new unit with wall removal, painting and electrical installation.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Maeving Ltd Coventry (\"contract awarded\" OR \"wins contract\" OR \"signs agreement\" OR \"secures deal\")",
      "results": [
        {
          "title": "Maeving wins \u00a33m export deal to grow US and Europe sales",
          "url": "https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/",
          "snippet": "Maeving landed a \u00a33million government-backed deal to help them build more bikes and sell them abroad, creating 13 new jobs in Coventry. The money is backed by UK Export Finance and will help Maeving keep up with growing demand in the USA, Germany and France, with more European countries to follow.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Maeving wins \u00a311m funding boost | British Dealer News",
          "url": "https://britishdealernews.co.uk/news/uk/maeving-wins-11m-funding-boost/",
          "snippet": "Maeving raised \u00a311m in March 2026, mostly from private investors but including a half-million-pound deal with the West Midlands Co-Investment Fund aimed at boosting manufacturing in the area.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Maeving Ltd Coventry (project OR programme OR construction OR \"delivery phase\" OR \"site works\")",
      "results": [
        {
          "title": "Maeving Tender",
          "url": "https://maeving.com/pages/maeving-tender",
          "snippet": "Maeving Ltd sought contractors to refurbish its Coventry premises, with works expected to commence December 2023 and complete by February 2024, part-funded by the UK Shared Prosperity Fund.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Maeving Ltd Coventry (\"enters market\" OR \"new market\" OR export OR \"overseas expansion\" OR \"first shipment\")",
      "results": [
        {
          "title": "Maeving in the right direction: E-motorbike maker gears up exports with UKEF backing - GOV.UK",
          "url": "https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing",
          "snippet": "Maeving has secured a \u00a33m trade finance facility from HSBC UK, backed by UK Export Finance, to invest in production capacity for growing demand in the US, Germany and France, with further European markets to follow, creating 13 new jobs at Coventry.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "British electric bike firm Maeving gets Government cash to fuel export push",
          "url": "https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/",
          "snippet": "Maeving began exporting to California, Germany and France in 2023, exports around half its bikes, and US sales have risen fivefold this year versus 2024 despite tariff-driven disruption.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Coventry e-motorbike maker Maeving secures \u00a38m to fuel growth and overseas expansion",
          "url": "https://evpowered.co.uk/news/maeving-raises-8m-electric-motorbike-expansion/",
          "snippet": "Maeving raised \u00a38m from venture capital and angel investors to boost production, expand exports and target commuters and women with lightweight city-friendly bikes.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Maeving Ltd Coventry (expansion OR expands OR \"capacity increase\" OR \"scaling up\" OR growth)",
      "results": [
        {
          "title": "Maeving Is Scaling Coventry Production as Overseas Demand Grows | Buck City Biker",
          "url": "https://www.buckcitybiker.co.uk/news/maeving-scales-coventry-production-overseas-demand",
          "snippet": "Maeving is scaling production in Coventry as demand grows across the US and Europe, with 13 new jobs planned. Sales in the US have grown fivefold in the past year. The Coventry site has capacity to produce up to 11,000 bikes annually.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Electric motorbike maker lands \u00a33m funding to drive international growth | Insider Media",
          "url": "https://www.insidermedia.com/news/midlands/electric-motorbike-maker-lands-3m-funding-to-drive-international-growth",
          "snippet": "Coventry-based Maeving has received trade financing from HSBC UK to invest in production capacity to meet growing demand in the US, Germany and France, with plans to expand into further European markets in future.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Maeving Ltd Coventry (\"new facility\" OR \"opens site\" OR \"distribution centre\" OR warehouse OR \"new factory\")",
      "results": [
        {
          "title": "Maeving in 2023: A Year To Remember",
          "url": "https://maeving.com/en-us/blogs/news/maeving-in-2023-a-year-to-remember",
          "snippet": "In late 2023 Maeving relocated to a 50,000 sq ft factory in Coventry on Sibree Road, Stonebridge Trading Estate, five times larger than its previous factory at Herald Business Park, boosting annual production capacity from 1,000 to 7,500 motorcycles.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Maeving Ltd Coventry (relocation OR relocates OR \"moves to\" OR \"site consolidation\" OR \"new headquarters\")",
      "results": [
        {
          "title": "Maeving in 2023: A Year To Remember",
          "url": "https://maeving.com/en-us/blogs/news/maeving-in-2023-a-year-to-remember",
          "snippet": "Maeving's headquarters moved to Sibree Road, Stonebridge Trading Estate, Coventry in late 2023 from Herald Business Park, driven by production demand following expansion into mainland Europe and the United States.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:baltex.co.uk news",
      "results": [
        {
          "title": "News - Baltex",
          "url": "https://baltex.co.uk/news/",
          "snippet": "Baltex news index. Baltex announced it will unveil a new look and updated communications at Techtextil, focusing on medical, military, aerospace, automotive and composites textile science.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "The Rising Role of Knitted Fabrics in Aircraft Interiors",
          "url": "https://baltex.co.uk/knitted-fabrics-aircraft-interiors/",
          "snippet": "Baltex article on how knitted fabrics offer comfort, sustainability and weight savings in modern aircraft interiors.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:baltex.co.uk press release announcement",
      "results": [
        {
          "title": "News - Baltex",
          "url": "https://baltex.co.uk/news/",
          "snippet": "Baltex news page. Latest news and developments in technical textiles.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "History - Baltex",
          "url": "https://baltex.co.uk/about/history/",
          "snippet": "Baltex was founded in 1831 by William and Francis Ball in Ilkeston, Derbyshire, and remains a leading technical textile manufacturer.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:baltex.co.uk projects contract",
      "results": [
        {
          "title": "Capabilities - Baltex",
          "url": "https://baltex.co.uk/about/capabilities/",
          "snippet": "Baltex employs stringent quality control measures at every stage following ISO 9001 quality standards, with tailored product development for customer projects.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Fabrics for the Contract Furnishing industry - Baltex",
          "url": "https://baltex.co.uk/markets/contract-furnishing/",
          "snippet": "Baltex offers advanced technical fabrics for the contract furnishing industry, including FR and non-FR meshes in polyester and Trevira CS.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Baltex Ilkeston (\"contract awarded\" OR \"wins contract\" OR \"signs agreement\" OR \"secures deal\")",
      "results": []
    },
    {
      "query": "Baltex Ilkeston (project OR programme OR construction OR \"delivery phase\" OR \"site works\")",
      "results": [
        {
          "title": "Baltex funding backs European technical textiles growth - Industrial News",
          "url": "https://industrialnews.co.uk/baltex-funding-backs-european-technical-textiles-growth/",
          "snippet": "Baltex received funding for investment in production, including AI-integrated upgrades for three legacy machines, with spending divided between the company's Ilkeston manufacturing base and its Polish operation in Lodz.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Baltex Ilkeston (\"enters market\" OR \"new market\" OR export OR \"overseas expansion\" OR \"first shipment\")",
      "results": [
        {
          "title": "UK's Baltex accelerates international growth strategy - Knitting Industry",
          "url": "https://knittingindustry.com/uks-baltex-accelerates-international-strategy/",
          "snippet": "Baltex is producing more and more of its specialist textiles in the UK for export and is now also targeting the USA market following an approval from aircraft manufacturer Boeing. Exports account for 60% of the business and Baltex is targeting export growth of approximately 20% during the next year. The company works with agents in Hong Kong, Italy, Finland and the USA.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Baltex accelerates growth with HSBC UK support - Innovation in Textiles",
          "url": "https://innovationintextiles.com/baltex-accelerates-growth-with-hsbc-uk-support/",
          "snippet": "Baltex has received a seven-figure funding package from HSBC UK to support its growth strategy and expand its European operations. In 2008 Baltex set up a subsidiary company in Poland which acts as a hub for business growth in the heart of Europe.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Baltex Ilkeston (expansion OR expands OR \"capacity increase\" OR \"scaling up\" OR growth)",
      "results": [
        {
          "title": "Baltex secures seven-figure funding to drive European expansion - The Manufacturer",
          "url": "https://www.themanufacturer.com/articles/baltex-secures-seven-figure-funding-to-drive-european-expansion/",
          "snippet": "The HSBC UK funding has enabled Baltex to expand its workforce with three new appointments and begin modernising production by replacing three legacy machines with AI-integrated equipment, intended to improve operational efficiency, increase production capacity and support future growth. Baltex expects the investment to deliver a 20% increase in export growth over the next 12 months.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Further investment at Baltex",
          "url": "https://innovationintextiles.com/further-investment-at-baltex/",
          "snippet": "Baltex has made a significant investment at its Ilkeston site with the acquisition of a state-of-the-art 18-gauge Karl Mayer high speed knitting machine, enabling production of heavy weight load bearing mesh fabrics.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Baltex Ilkeston (\"new facility\" OR \"opens site\" OR \"distribution centre\" OR warehouse OR \"new factory\")",
      "results": []
    },
    {
      "query": "Baltex Ilkeston (relocation OR relocates OR \"moves to\" OR \"site consolidation\" OR \"new headquarters\")",
      "results": [
        {
          "title": "Baltex Company Profile | ILKESTON | Dun & Bradstreet",
          "url": "https://www.dnb.com/business-directory/company-profiles.baltex.146e572fbf5a1d0c28c9ff10a94f7213.html",
          "snippet": "Baltex headquarters is located at Ilkeston, England. The company operates production facilities in the UK and in Poland. No relocation announced.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:bramblefoods.co.uk news",
      "results": [
        {
          "title": "News - Bramble Foods",
          "url": "https://bramblefoods.com/news/",
          "snippet": "Bramble Foods news index. Bramble Foods launched competitively priced single portion vegan cake slices following the successful launch of its range of vegan loaf cakes.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Bramble Foods opens new distribution hub and eyes expansion - Grocery Gazette",
          "url": "https://www.grocerygazette.co.uk/2026/07/31/bramble-foods-opens-new-distribution-hub-and-eyes-expansion/",
          "snippet": "Bramble Foods opened a new 67,000 sq ft national distribution centre in Market Harborough at Lancaster House, Airfield Business Park, which becomes the company's main UK distribution hub, increasing warehousing and stockholding capacity.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:bramblefoods.co.uk press release announcement",
      "results": [
        {
          "title": "Welcome to Bramble Foods - Bramble Foods",
          "url": "https://bramblefoods.com/",
          "snippet": "In July 2026 the business expanded into Lancaster House, a purpose-built 67,000 sq ft distribution centre at Airfield Business Park, Market Harborough. In January 2025 Bramble acquired Yorkshire-based Whitakers Chocolates; in January 2024 it acquired The Bay Tree Food Co.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:bramblefoods.co.uk projects contract",
      "results": []
    },
    {
      "query": "Bramble Group Market Harborough (\"contract awarded\" OR \"wins contract\" OR \"signs agreement\" OR \"secures deal\")",
      "results": []
    },
    {
      "query": "Bramble Group Market Harborough (project OR programme OR construction OR \"delivery phase\" OR \"site works\")",
      "results": [
        {
          "title": "Final phase of Airfield Business Park underway - will support expansion of LDC-backed food manufacturer | Insider Media",
          "url": "https://www.insidermedia.com/news/midlands/final-phase-of-airfield-business-park-underway-will-support-expansion-of-ldc-backed-food-manufacturer",
          "snippet": "The final phase of Airfield Business Park is underway after a groundbreaking ceremony in Market Harborough. Bramble Foods, an LDC-backed fine foods manufacturer and distributor, already employs more than 150 people in Market Harborough and will occupy a 67,000 sq ft unit.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Family Food Business Opens Landmark Distribution Centre as Employee Celebrates 50 Years of Service | LDC",
          "url": "https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/",
          "snippet": "Bramble Foods has expanded into Lancaster House, a purpose-built 67,000 sq ft distribution centre at Airfield Business Park, Market Harborough, built by Leicestershire County Council. The facility becomes Bramble Foods' main national distribution hub, significantly increasing warehousing and distribution capacity while supporting an expanding portfolio of premium food brands and a growing customer base across the UK.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Bramble Group Market Harborough (\"enters market\" OR \"new market\" OR export OR \"overseas expansion\" OR \"first shipment\")",
      "results": [
        {
          "title": "Bramble Foods opens new distribution hub and eyes expansion - Grocery Gazette",
          "url": "https://www.grocerygazette.co.uk/2026/07/31/bramble-foods-opens-new-distribution-hub-and-eyes-expansion/",
          "snippet": "Bramble Group, which includes Whitakers Chocolates, The Bay Tree and Lings, currently employs around 300 people and expects the new facility to support the creation of up to 50 skilled roles over the coming years. The results contain no overseas market entry or export announcement.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Bramble Group Market Harborough (expansion OR expands OR \"capacity increase\" OR \"scaling up\" OR growth)",
      "results": [
        {
          "title": "Bramble Foods expansion to create 50 new jobs in Leicestershire - The Manufacturer",
          "url": "https://www.themanufacturer.com/articles/bramble-foods-expansion-to-create-50-new-jobs-in-leicestershire/",
          "snippet": "Bramble Foods is set to create 50 new jobs following the opening of its new national distribution centre in Market Harborough. Bramble Group employs around 300 people and expects to increase its workforce to 350 over the coming years.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Bramble Foods opens growth hub with 50 new roles on the menu | TheBusinessDesk.com",
          "url": "https://www.thebusinessdesk.com/eastmidlands/news/2113391-bramble-foods-opens-growth-hub-with-50-new-roles-on-the-menu",
          "snippet": "The official opening of Lancaster House was carried out in late July 2026 by Steve Heighton, who is celebrating 50 years of service with the business.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Bramble Group Market Harborough (\"new facility\" OR \"opens site\" OR \"distribution centre\" OR warehouse OR \"new factory\")",
      "results": [
        {
          "title": "Bramble Foods opens new distribution hub and eyes expansion - Grocery Gazette",
          "url": "https://www.grocerygazette.co.uk/2026/07/31/bramble-foods-opens-new-distribution-hub-and-eyes-expansion/",
          "snippet": "Bramble Foods has opened a new 67,000 sq ft national distribution centre in Market Harborough, moving into Lancaster House at Airfield Business Park, a purpose-built facility developed by Leicestershire County Council. The site becomes Bramble Foods' main UK distribution hub, increasing warehousing and stockholding capacity as it expands its product range and customer base.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Bramble Group Market Harborough (relocation OR relocates OR \"moves to\" OR \"site consolidation\" OR \"new headquarters\")",
      "results": [
        {
          "title": "Harborough-based food manufacturer and distributor moves to new, bigger base on the edge of town",
          "url": "https://www.harboroughmail.co.uk/business/harborough-based-food-manufacturer-and-distributor-moves-to-new-bigger-base-on-the-edge-of-town-potentially-creating-more-jobs-in-the-process-8832307",
          "snippet": "Bramble Foods moved into Lancaster House at Airfield Business Park, which is the company's third base in the town. The move represented an investment of around half a million pounds and allowed the company to continue growing in Market Harborough, avoiding the need to look elsewhere for larger premises.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Airfield feeds ambitions as Bramble expand onto business park | Leicestershire County Council",
          "url": "https://www.leicestershire.gov.uk/news/airfield-feeds-ambitions-as-bramble-expand-onto-business-park",
          "snippet": "Bramble expands onto Airfield Business Park, Market Harborough, in a purpose-built unit developed by Leicestershire County Council.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:devolkitchens.com news",
      "results": [
        {
          "title": "We won a King's Award! - The deVOL Journal - deVOL Kitchens",
          "url": "https://www.devolkitchens.com/blog/we-won-a-kings-award",
          "snippet": "deVOL Kitchens has been honoured with a King's Award for Enterprise for International Trade for outstanding continuous growth in overseas sales. From virtually no exports, deVOL has grown overseas revenue by 2,300% over the last 6 years, with 31% of sales now exported and total turnover and net profits increasing almost three-fold.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Our Bond Street showroom in NoHo, NYC - The deVOL Journal",
          "url": "https://www.devolkitchens.com/blog/our-bond-street-showroom-in-noho-nyc-the-classic-english-kitchen",
          "snippet": "deVOL's Bond Street showroom in New York's NoHo neighbourhood, designed by Helen Parker, deVOL's Creative Director.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:devolkitchens.com press release announcement",
      "results": [
        {
          "title": "Press Coverage | deVOL Kitchens",
          "url": "https://www.devolkitchens.com/about/press",
          "snippet": "deVOL press coverage gallery featuring selected features from magazines and online publications.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "The first look at deVOL Kitchens New York showroom on Bond Street in Manhattan",
          "url": "https://www.devolkitchens.com/blog/devol-new-york-showroom-now-open",
          "snippet": "deVOL celebrated the opening of its New York showroom with builders, architects, artists and members of the press.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:devolkitchens.com projects contract",
      "results": [
        {
          "title": "Overseas Kitchens Projects FAQs - The deVOL Journal - deVOL Kitchens",
          "url": "https://www.devolkitchens.com/blog/overseas-kitchen-projects-faqs",
          "snippet": "deVOL has completed projects in 26 countries and works on properties of all shapes and sizes around the world. For overseas customers deVOL offers a remote design service via video call.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:devolkitchens.co.uk news",
      "results": [
        {
          "title": "We won a King's Award! - The deVOL Journal - deVOL Kitchens",
          "url": "https://www.devolkitchens.co.uk/blog/we-won-a-kings-award",
          "snippet": "deVOL Kitchens has been honoured with a King's Award for Enterprise for International Trade. From virtually no exports, deVOL has grown overseas revenue by 2,300% over the last 6 years, with 31% of sales now exported.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:devolkitchens.co.uk press release announcement",
      "results": [
        {
          "title": "The All-In-One Island by deVOL launches in Taipei! - The deVOL Journal",
          "url": "https://www.devolkitchens.co.uk/blog/the-all-in-one-island-by-devol-launches-in-taipei",
          "snippet": "The All-In-One Island by deVOL launches in Taipei.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "A historic new showroom in Bath | deVOL Kitchens",
          "url": "https://www.devolkitchens.co.uk/contact/george-street-bath",
          "snippet": "deVOL announced the opening of a showroom in Bath, a world heritage city and one of the great spa towns of Europe.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:devolkitchens.co.uk projects contract",
      "results": [
        {
          "title": "Overseas Kitchens Projects FAQs - The deVOL Journal - deVOL Kitchens",
          "url": "https://www.devolkitchens.co.uk/blog/overseas-kitchen-projects-faqs",
          "snippet": "deVOL has completed projects in 26 countries. Design appointments last 2-3 hours and are free of charge for UK projects; for overseas customers deVOL offers a remote design service via video call.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "deVOL Kitchens Loughborough (\"contract awarded\" OR \"wins contract\" OR \"signs agreement\" OR \"secures deal\")",
      "results": [
        {
          "title": "About Us | deVOL Kitchens",
          "url": "https://www.devolkitchens.com/about",
          "snippet": "deVOL was founded in 1989 by two design graduates from Loughborough University and is a rapidly growing company employing over 400 people across 9 premises.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "deVOL Kitchens Loughborough (project OR programme OR construction OR \"delivery phase\" OR \"site works\")",
      "results": [
        {
          "title": "About Us | deVOL Kitchens",
          "url": "https://www.devolkitchens.com/about",
          "snippet": "deVOL moved into a new workshop on Falcon Business Park in Loughborough after finding a building large enough to accommodate all manufacturing departments under one roof. deVOL employs over 400 people across 9 premises.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "deVOL Kitchens Loughborough (\"enters market\" OR \"new market\" OR export OR \"overseas expansion\" OR \"first shipment\")",
      "results": [
        {
          "title": "DeVol opens showroom in New York - first outside UK | kbbreview",
          "url": "https://www.kbbreview.com/22981/topstory/devol-opens-showroom-in-new-york/",
          "snippet": "deVOL Kitchens, a Loughborough-based bespoke kitchen retailer and manufacturer, opened its first showroom in the USA, its first outside the UK, in New York City's NoHo neighbourhood. Every deVOL kitchen is still made in Leicestershire, England.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Overseas Kitchens Projects FAQs - The deVOL Journal - deVOL Kitchens",
          "url": "https://www.devolkitchens.co.uk/blog/overseas-kitchen-projects-faqs",
          "snippet": "deVOL specialises in traditional English kitchens but sends its furniture all over the world, having completed projects in 26 countries.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Devol Kitchens | See Recent Shipments | ImportGenius",
          "url": "https://www.importgenius.com/suppliers/devol-kitchens",
          "snippet": "US Customs records show 218 US shipments available for Devol Kitchens.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "deVOL Kitchens Loughborough (expansion OR expands OR \"capacity increase\" OR \"scaling up\" OR growth)",
      "results": [
        {
          "title": "Luxury kitchen supplier's expansion is a recipe for success",
          "url": "https://www.matherjamie.co.uk/latest-news/luxury-kitchen-supplier-s-expansion-is-a-recipe-for-success/",
          "snippet": "The former Karl Mayer head office on Kings Road in Shepshed was sold to deVOL Kitchens, which bought the 40,000 sq ft Karl Mayer knitting machine factory for \u00a31.95m. deVOL had acquired lots of small units in Loughborough over the last 10 years and described the Shepshed purchase as an exciting new step.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Tenth year of growth for expanding kitchen retailer | Insider Media",
          "url": "https://www.insidermedia.com/news/midlands/tenth-year-of-growth-for-expanding-kitchen-retailer",
          "snippet": "deVOL prepared to increase production capacity significantly with the purchase of a premises to move all manufacturing under one roof. Revenue has a compounded annual growth rate of 22% over the last five years.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "deVOL Kitchens Loughborough (\"new facility\" OR \"opens site\" OR \"distribution centre\" OR warehouse OR \"new factory\")",
      "results": [
        {
          "title": "Luxury kitchen supplier's expansion is a recipe for success",
          "url": "https://www.matherjamie.co.uk/latest-news/luxury-kitchen-supplier-s-expansion-is-a-recipe-for-success/",
          "snippet": "deVOL Kitchens Ltd bought the 40,000 sq ft Karl Mayer knitting machine factory on Kings Road, Shepshed for \u00a31.95m. The property features more than 3,000 sq ft of office space plus more than 37,000 sq ft of industrial space, including a mezzanine and loading yard. deVOL planned to install CNC machines and computer-controlled spraying and sanding machines, and said it envisaged the need to increase production considerably for the new US showroom venture.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "deVOL Kitchens Loughborough (relocation OR relocates OR \"moves to\" OR \"site consolidation\" OR \"new headquarters\")",
      "results": [
        {
          "title": "Contact deVOL - Visit Kitchen Showrooms in Loughborough, Leicestershire",
          "url": "https://www.devolkitchens.com/contact",
          "snippet": "deVOL Kitchens' headquarters are at Cotes Mill, Nottingham Road, Cotes, Loughborough LE12. deVOL employs over 400 people across 9 premises. No relocation announced.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:nmsinfrastructure.com news",
      "results": [
        {
          "title": "News \u2014 NMSI - NMS Infrastructure",
          "url": "https://www.nmsinfrastructure.com/news/",
          "snippet": "NMSI provides sustainable turnkey healthcare, education, agricultural and other infrastructure solutions that enhance the lives of those living in the rural communities of Africa, and operates from UK and Johannesburg management offices, as well as project and partner offices across Africa.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "News \u2014 NMSI",
          "url": "https://www.nmsinfrastructure.com/blog",
          "snippet": "NMSI news and blog index.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:nmsinfrastructure.com press release announcement",
      "results": [
        {
          "title": "NMSI listed on the 2024 FEBE Growth 100 \u2014 NMSI",
          "url": "https://www.nmsinfrastructure.com/blog/2024/6/15/utl8varlpt2jx4og3k6i8ul3n2fbis",
          "snippet": "NMSI was listed on the 2024 FEBE Growth 100. Frederik Hsu, Deputy Chairman of NMS International Group, commented that the company continues to pursue its founding values and that the past year has seen a record number of hospital completions.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "NMSI",
          "url": "https://www.nmsinfrastructure.com/",
          "snippet": "NMS Infrastructure is a leading EPCF Developer specialising in transformational infrastructure projects in Sub-Saharan Africa.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:nmsinfrastructure.com projects contract",
      "results": [
        {
          "title": "NMSI",
          "url": "https://www.nmsinfrastructure.com/?p2df",
          "snippet": "NMSI delivers high impact projects supporting the pillars of stability and security in the provision of social infrastructure, working with local workforces and supply chains. NMSI is under contract to build 22 state of the art district hospitals for Africa with work underway on 12 sites, and with over 1,000,000 sq ft under construction, NMSI's healthcare upgrade programme is one of the largest multi-site light steel frame construction programmes ever undertaken in Africa.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Trade Finance Magazine Deal of the Year 2012 \u2014 NMSI",
          "url": "https://www.nmsinfrastructure.com/blog/2018/9/5/trade-finance-magazine",
          "snippet": "The contract for a major project was awarded to NMS Infrastructure, a UK SME, which led a consortium of both UK and Ghana based contractors, with Ghana's Ministry of Health as the end buyer. Signed in October 2012, the financing consisted of a $162.9 million export credit facility covered by UK Export Finance (UKEF).",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "NMS International Group Market Harborough (\"contract awarded\" OR \"wins contract\" OR \"signs agreement\" OR \"secures deal\")",
      "results": [
        {
          "title": "NMS INTERNATIONAL GROUP LTD overview - GOV.UK",
          "url": "https://find-and-update.company-information.service.gov.uk/company/06360525",
          "snippet": "NMS INTERNATIONAL GROUP LTD, company number 06360525, registered office Market Harborough, Leicestershire.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "NMS International Group, Market Harborough",
          "url": "https://market-harborough.cylex-uk.co.uk/company/nms-international-group-19325019.html",
          "snippet": "NMS International Group is located at Office 8, The Lincoln Building, Eckland Lodge Business Park, Market Harborough, Leicestershire, and provides independent technical advice and project-managed solutions to customers in Security & Defence, Emergency Response and Infrastructure sectors throughout the world.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "NMS International Group Market Harborough (project OR programme OR construction OR \"delivery phase\" OR \"site works\")",
      "results": [
        {
          "title": "NMS Infrastructure Limited | LinkedIn",
          "url": "https://gh.linkedin.com/company/nmsinfrastructurelimited",
          "snippet": "NMS Infrastructure Limited \u2014 EPCF developer delivering infrastructure projects in Sub-Saharan Africa.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Services \u2014 NMSI",
          "url": "https://www.nmsinfrastructure.com/services",
          "snippet": "NMS Infrastructure has an office at The Lincoln Building, Eckland Lodge Business Park, Market Harborough, LE16 8HB, UK, and operates primarily on infrastructure projects in Sub-Saharan Africa.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "NMS International Group Market Harborough (\"enters market\" OR \"new market\" OR export OR \"overseas expansion\" OR \"first shipment\")",
      "results": [
        {
          "title": "NMS Infrastructure - Crunchbase Company Profile & Funding",
          "url": "https://www.crunchbase.com/organization/nms-infrastructure",
          "snippet": "NMS Infrastructure company profile. No market-entry or export announcement listed.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "NMS International Group Market Harborough (expansion OR expands OR \"capacity increase\" OR \"scaling up\" OR growth)",
      "results": [
        {
          "title": "NMS International Group, Market Harborough",
          "url": "https://market-harborough.cylex-uk.co.uk/company/nms-international-group-19325019.html",
          "snippet": "NMS International Group provides project-managed solutions and independent technical advice in Security & Defence, Emergency Response and Infrastructure sectors. Located at The Lincoln Building, Eckland Lodge Business Park, Market Harborough, LE16 8HB, UK.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "NMS International Group Market Harborough (\"new facility\" OR \"opens site\" OR \"distribution centre\" OR warehouse OR \"new factory\")",
      "results": [
        {
          "title": "NMS Inaugurates UK Central Warehouse \u2014 NMSI",
          "url": "https://www.nmsinfrastructure.com/blog/2022/6/28/nms-inaugurates-new-warehouse",
          "snippet": "NMS Infrastructure launched a new industrial warehouse facility adjacent to its headquarters in Market Harborough to handle export cargoes for projects in sub-Saharan Africa. The warehouse is staffed by NMSI Logistics team members who carry out pre-shipment testing and quality control inspections on equipment prior to containerisation and shipment.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Bramble Foods opens new distribution hub and eyes expansion",
          "url": "https://www.grocerygazette.co.uk/2026/07/31/bramble-foods-opens-new-distribution-hub-and-eyes-expansion/",
          "snippet": "Bramble Foods has opened a new 67,000 sq ft distribution hub, Lancaster House, at Airfield Business Park, Market Harborough.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "NMS International Group Market Harborough (relocation OR relocates OR \"moves to\" OR \"site consolidation\" OR \"new headquarters\")",
      "results": [
        {
          "title": "Contact \u2014 NMSI - NMS Infrastructure",
          "url": "https://www.nmsinfrastructure.com/contact",
          "snippet": "NMS Infrastructure, The Lincoln Building, Eckland Lodge Business Park, Market Harborough, LE16 8HB, UK. No relocation announced.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:winbrogroup.com news",
      "results": [
        {
          "title": "Winbro News & Updates | Winbro",
          "url": "https://winbrogroup.com/news/",
          "snippet": "Winbro news page with updates about machine solutions, services, exhibitions and events. Items include participation in EMO Hannover 2023 with the ABLATE-300 and EDM-300 machines, MD&M West, and the Queen's Award for Enterprise in Innovation presented in June 2016.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:winbrogroup.com press release announcement",
      "results": [
        {
          "title": "Winbro News & Updates | Winbro",
          "url": "https://winbrogroup.com/news/",
          "snippet": "Winbro announced participation in EMO Hannover 2023, showcased technologies at the Medical Design event in February and exhibited at SEMICON WEST in California to promote Winbro's Re-Imagines initiative.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:winbrogroup.com projects contract",
      "results": [
        {
          "title": "Partner Support - Machines, Tools, and Technologies | Winbro",
          "url": "https://winbrogroup.com/partner-support/",
          "snippet": "Winbro offers a wide range of tailored service and maintenance contracts to suit the needs of customer sites. Winbro's Global Technology Centers provide application and process technology to support internal or customer funded R&D projects.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Winbro Group Technologies Shepshed (\"contract awarded\" OR \"wins contract\" OR \"signs agreement\" OR \"secures deal\")",
      "results": [
        {
          "title": "Winbro Group Technologies 2026 Company Profile | PitchBook",
          "url": "https://pitchbook.com/profiles/company/130557-16",
          "snippet": "Winbro Group Technologies is headquartered in Shepshed, United Kingdom, and was acquired on 1 October 2020 by Quaser Machine Tools. No contract award is listed.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Winbro Group Technologies Shepshed (project OR programme OR construction OR \"delivery phase\" OR \"site works\")",
      "results": [
        {
          "title": "Winbro Opens New Advanced Machining Facility Following Accelerated Growth | MEM Magazine",
          "url": "https://memuknews.com/manufacturing/tooling/winbro-opens-new-advanced-machining-facility-following-accelerated-growth/",
          "snippet": "A 43,000 sq ft facility in Shepshed was opened by the Minister for Small Business, Industry and Enterprise. The facility was needed to meet unprecedented customer demand following government investment in a programme to improve the competitiveness of UK aerospace companies.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Winbro Group Technologies Shepshed (\"enters market\" OR \"new market\" OR export OR \"overseas expansion\" OR \"first shipment\")",
      "results": [
        {
          "title": "Winbro Group Technologies : Vision Engineered | Manufacturing Outlook",
          "url": "https://www.mfg-outlook.com/metal-machinery-manufacturing/winbro-group-technologies-vision-engineered",
          "snippet": "Winbro has a global presence spanning a triad of locations in Rock Hill (US), Shepshed (UK) and Taichung (Taiwan), with each site incorporating Winbro's three revenue streams of contract manufacturing, systems solutions and partner services.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Winbro Group Technologies Shepshed (expansion OR expands OR \"capacity increase\" OR \"scaling up\" OR growth)",
      "results": [
        {
          "title": "Midlands Aerospace Alliance - Aerospace firm takes up Shepshed warehouse",
          "url": "https://www.midlandsaerospace.org.uk/winbro-new-facilities-jun-2015",
          "snippet": "Winbro Group Technologies leased a 28,147 sq ft warehouse on Gelders Hall Road in Shepshed, known as Illuma House, as part of an expansion plan to support the long-term development of its aerospace parts production. Reported June 2015.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Government Minister opens Winbro's new Advanced Machining centre | Quaser Machine tools Inc.",
          "url": "https://www.quaser.com/blog/news-2/government-minister-opens-winbros-new-advanced-machining-centre-83",
          "snippet": "Winbro added a new 43,000 sq ft Advanced Machining Facility in Shepshed, near Loughborough, anticipating staffing growth from 170 to more than 300 by the middle of 2016. The company planned to expand its offering in 2023 by creating Technology Centers at each of its sites.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Winbro Group Technologies Shepshed (\"new facility\" OR \"opens site\" OR \"distribution centre\" OR warehouse OR \"new factory\")",
      "results": [
        {
          "title": "Midlands Aerospace Alliance - Aerospace firm takes up Shepshed warehouse",
          "url": "https://www.midlandsaerospace.org.uk/winbro-new-facilities-jun-2015",
          "snippet": "Winbro Group Technologies leased a 28,147 sq ft warehouse on Gelders Hall Road in Shepshed, known as Illuma House, in June 2015.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Winbro Group Technologies Shepshed (relocation OR relocates OR \"moves to\" OR \"site consolidation\" OR \"new headquarters\")",
      "results": [
        {
          "title": "Winbro Group Technologies \u00bb PP Control & Automation",
          "url": "https://www.ppcanda.com/case-studies/winbro-group-technologies/",
          "snippet": "The Leicestershire-based business was in the process of relocating to one 60,000 sq ft advanced manufacturing facility in Shepshed. No date is given for the move in this source.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:slackandparr.com news",
      "results": [
        {
          "title": "News from 20 November 2025 - Slack & Parr",
          "url": "https://www.slackandparr.com/about-us/news/2025/11/20/",
          "snippet": "Slack and Parr enjoyed a hugely successful ITMA in Singapore.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "News - Slack & Parr",
          "url": "https://www.slackandparr.com/about-us/news/",
          "snippet": "Slack & Parr news index. In November 2023 the Managing Director of Kegworth-based Slack & Parr said becoming part of a larger engineering group had made the company stronger and more resilient.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:slackandparr.com press release announcement",
      "results": [
        {
          "title": "Avingtrans acquires Slack and Parr",
          "url": "https://www.slackandparr.com/about-us/news/archive/",
          "snippet": "Avingtrans PLC announced that its subsidiary Hayward Tyler Fluid Handling Limited completed the acquisition of certain assets of Slack & Parr from administration, together with Slack and Parr's overseas subsidiaries in the USA and Asia. Slack & Parr is a family-owned manufacturer of specialist pumps founded in 1917.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Slack & Parr joins forces with new distributor",
          "url": "https://www.slackandparr.com/about-us/news/2021/03/19/slack-parr-joins-forces-with-new-distributor/",
          "snippet": "In March 2021 Slack & Parr announced a partnership with Hydraulics Online Ltd to harness greater market reach.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "site:slackandparr.com projects contract",
      "results": [
        {
          "title": "About Us - Slack & Parr",
          "url": "https://www.slackandparr.com/about-us/",
          "snippet": "Slack & Parr manufactures high-precision gear metering pumps, rotary hydraulic flow dividers and industrial dosing pumps from Kegworth, with case studies published on its site.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Slack & Parr Kegworth (\"contract awarded\" OR \"wins contract\" OR \"signs agreement\" OR \"secures deal\")",
      "results": [
        {
          "title": "Hayward Tyler buys Slack & Parr out of administration | Scottish Financial News",
          "url": "https://www.scottishfinancialnews.com/articles/glasgow-based-hayward-tyler-buys-slack-parr-out-of-administration",
          "snippet": "Hayward Tyler Fluid Handling Limited, a subsidiary of Avingtrans PLC, purchased Slack & Parr Limited out of administration in August 2023, ensuring continuation of operations at the Kegworth base and protecting 100 roles. The deal incorporated Slack & Parr's trading subsidiaries in the USA and China, supporting 27 additional jobs. Slack & Parr entered administration on 3 July 2023 following ongoing losses and funding issues.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Slack & Parr Kegworth (project OR programme OR construction OR \"delivery phase\" OR \"site works\")",
      "results": [
        {
          "title": "Multi-million-pound design and manufacturing facility now completed for Slack & Parr \u2013 Hydraulics & Pneumatics",
          "url": "https://hpmag.co.uk/multi-million-pound-design-and-manufacturing-facility-now-completed-for-slack-parr/",
          "snippet": "Work has been completed on a \u00a34.3m precision engineering facility for Slack & Parr at Kegworth in North West Leicestershire. The 5300 sq m design and build project was designed by Staniforth Architects and project managed by Benchmark Properties.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Slack & Parr Kegworth (\"enters market\" OR \"new market\" OR export OR \"overseas expansion\" OR \"first shipment\")",
      "results": [
        {
          "title": "Slack & Parr weighs up jobs losses at Kegworth facility | Insider Media",
          "url": "https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility",
          "snippet": "Slack & Parr is consulting on the loss of up to 40 roles at its Kegworth facility, citing slowing Chinese and Far East investment, tariffs in new export markets and rising domestic costs.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Slack & Parr Ltd",
          "url": "https://manufacturing-today.com/news/slack-parr-ltd/",
          "snippet": "Slack & Parr operates from a 64,000 sq ft manufacturing facility in Kegworth and also has facilities in Charlotte, North Carolina and Shanghai, China, supplying high-precision gear metering pumps to customers around the world.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Slack & Parr Kegworth (expansion OR expands OR \"capacity increase\" OR \"scaling up\" OR growth)",
      "results": [
        {
          "title": "Manufacturer makes multimillion-pound move to new HQ | TheBusinessDesk.com",
          "url": "https://www.thebusinessdesk.com/eastmidlands/news/2042831-manufacturer-makes-multimillion-pound-move-to-new-hq",
          "snippet": "A Kegworth manufacturer moved into a new 73,000 sq ft HQ premises after securing a multi-million pound loan facility from ASG. Completed in September 2020, the site represents an investment of approximately \u00a34.5 million and has been fully operational since February 2021.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Slack & Parr Kegworth (\"new facility\" OR \"opens site\" OR \"distribution centre\" OR warehouse OR \"new factory\")",
      "results": [
        {
          "title": "Multi-million-pound design and manufacturing facility now completed for Slack & Parr \u2013 Hydraulics & Pneumatics",
          "url": "https://hpmag.co.uk/multi-million-pound-design-and-manufacturing-facility-now-completed-for-slack-parr/",
          "snippet": "Slack & Parr's new state-of-the-art facility was completed in September 2020 and has been fully operational since February 2021, representing an investment of approximately \u00a34.5 million. Slack & Parr has its R&D and manufacturing centre at its Kegworth headquarters and four other facilities around the world.",
          "retrievedAt": "2026-09-09"
        }
      ]
    },
    {
      "query": "Slack & Parr Kegworth (relocation OR relocates OR \"moves to\" OR \"site consolidation\" OR \"new headquarters\")",
      "results": [
        {
          "title": "Multimillion-pound loan sees manufacturer move to new HQ | TheBusinessDesk.com",
          "url": "https://www.thebusinessdesk.com/eastmidlands/news/2047181-multimillion-pound-loan-sees-manufacturer-move-to-new-hq",
          "snippet": "In November 2020 Slack & Parr moved into its new 73,000 sq ft headquarters on Long Lane, Kegworth, after securing a multimillion-pound loan from ASG, having operated on the same site for over 100 years.",
          "retrievedAt": "2026-09-09"
        },
        {
          "title": "Administrators called in at 100-year-old manufacturer | TheBusinessDesk.com",
          "url": "https://www.thebusinessdesk.com/eastmidlands/news/2073166-future-uncertain-for-100-year-old-manufacturer",
          "snippet": "Administrators were called in at the 100-year-old Kegworth manufacturer Slack & Parr.",
          "retrievedAt": "2026-09-09"
        }
      ]
    }
  ]
};

interface ClaimInput {
  id: string;
  claimText: string;
  passage: string;
  url: string;
  topic: ClaimTopic;
  publicationDate?: string;
  eventDate?: string;
  stated: ExtractedClaim['identityAttributes'];
  confidence: number;
  originId?: string;
}

function claim(input: ClaimInput): ExtractedClaim {
  return {
    id: input.id,
    claimText: input.claimText,
    supportingPassage: input.passage,
    sourceUrl: input.url,
    topic: input.topic,
    ...(input.publicationDate ? { publicationDate: input.publicationDate } : {}),
    ...(input.eventDate ? { eventDate: input.eventDate } : {}),
    identityAttributes: input.stated,
    extractionConfidence: input.confidence,
    ...(input.originId ? { originId: input.originId } : {}),
    verification: 'search_snippet',
  };
}

const inf = (id: string, statement: string, derivedFrom: string[], reasoning: string): Inference => ({
  kind: 'inference',
  id,
  statement,
  derivedFrom,
  reasoning,
});

const hyp = (
  id: string,
  statement: string,
  derivedFrom: string[],
  reasoning: string,
  testableBy: string,
): Hypothesis => ({ kind: 'hypothesis', id, statement, derivedFrom, reasoning, testableBy });

/**
 * Extractions for the v5 corpus.
 *
 * DELIBERATE CONSTRAINT: where the evidence for a company is unchanged from
 * v3, the extraction is unchanged too — same claim text, same inference, same
 * hypothesis, same caveats. That includes the defects the commercial benchmark
 * found (Baltex's internal contradiction, deVOL's award-dated signal, Bramble's
 * demand-reducing event scored as increasing). Nothing in this milestone
 * addresses them, so rewriting them here would hide whether they persist and
 * would make the before/after comparison meaningless.
 *
 * What IS new is what the sweep and the family queries found: additional
 * claims, and one company that produced no signal at all in v4.
 */
export const liveExtractionsV5: ExtractionCorpus = {
  'maeving.com': {
    trigger: 'export_finance',
    whatChanged:
      '£3m UKEF-backed trade finance facility to build production capacity for the US, Germany and France, adding 13 jobs, against US sales already up fivefold year on year.',
    polarity: 'demand_increasing',
    polarityRationale:
      'Funded capacity expansion serving named export markets increases outbound consignment volume on a regulated cargo type.',
    consequence: {
      actionable: true,
      rationale: 'More cross-border consignments and more Class 9 documentation to produce.',
    },
    claims: [
      claim({
        id: 'v5-maeving-c1',
        claimText:
          'Maeving secured a £3m trade finance facility from HSBC UK, backed by UK Export Finance, to invest in production capacity for demand in the US, Germany and France, creating 13 new jobs at Coventry.',
        passage:
          'Maeving has secured a £3m trade finance facility from HSBC UK, backed by UK Export Finance, to invest in production capacity for growing demand in the US, Germany and France, with further European markets to follow, creating 13 new jobs at Coventry.',
        url: 'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
        topic: 'funding',
        publicationDate: '2026-08-15',
        eventDate: '2026-08-15',
        stated: {
          statedName: 'Maeving',
          statedGeography: { country: UK, town: 'Coventry' },
          statedIndustry: 'electric motorbike manufacturing',
        },
        confidence: 0.95,
        originId: 'ukef-maeving-release',
      }),
      claim({
        id: 'v5-maeving-c2',
        claimText:
          'Maeving began exporting to California, Germany and France in 2023, exports around half its bikes, and US sales have risen fivefold this year versus 2024 despite tariff-driven disruption.',
        passage:
          'Maeving began exporting to California, Germany and France in 2023, exports around half its bikes, and US sales have risen fivefold this year versus 2024 despite tariff-driven disruption.',
        url: 'https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/',
        topic: 'export_trade',
        publicationDate: '2026-08-15',
        eventDate: '2026-08-15',
        stated: {
          statedName: 'Maeving',
          statedGeography: { country: UK, town: 'Coventry' },
          statedIndustry: 'electric motorcycles',
        },
        confidence: 0.85,
      }),
      // NEW in v5 — surfaced by the major_contract family query. A separate
      // funding event from a separate publisher, so it is independent of the
      // UKEF release rather than another copy of it.
      claim({
        id: 'v5-maeving-c3',
        claimText:
          'Maeving raised £11m in March 2026, mostly from private investors, including a half-million-pound deal with the West Midlands Co-Investment Fund aimed at boosting manufacturing in the area. No day of the month is stated, so no event date is asserted.',
        passage:
          'Maeving raised £11m in March 2026, mostly from private investors but including a half-million-pound deal with the West Midlands Co-Investment Fund aimed at boosting manufacturing in the area.',
        url: 'https://britishdealernews.co.uk/news/uk/maeving-wins-11m-funding-boost/',
        topic: 'funding',
        stated: {
          statedName: 'Maeving',
          statedGeography: { country: UK, region: 'West Midlands' },
          statedIndustry: 'motorcycle manufacturing',
        },
        confidence: 0.8,
      }),
    ],
    inferences: [
      inf(
        'v5-maeving-i1',
        'Consignment volume on established US and European lanes is rising steeply — fivefold on the US lane — with funded capacity behind it and tariff friction to manage.',
        ['v5-maeving-c1', 'v5-maeving-c2', 'v5-maeving-c3'],
        'The company reports the fivefold increase itself, and two separate funding events fund the capacity to serve it.',
      ),
    ],
    hypothesis: hyp(
      'v5-maeving-h1',
      'Freight arrangements sized for 2023-era volumes are carrying several times that on a regulated cargo type, in a tariff environment — which is when rates, consolidation and DG documentation get reopened.',
      ['v5-maeving-i1'],
      'Growth of this rate on an existing lane changes how it should be shipped, even where a forwarder is already in place.',
      'Ask whether their current US arrangement was priced before the fivefold increase, and who handles the Class 9 paperwork.',
    ),
    owningFunction: {
      function: 'Operations / Supply Chain',
      rationale:
        'Export capacity and DG compliance sit with operations at this size; the trigger is a finance event but the freight decision is not.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Coventry manufacturer of physical goods, exporting around half its output, scaling on funded capacity.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note: 'Maeving has exported since 2023 and ships roughly half its output, so an incumbent forwarder is near-certain — this is displacement, not greenfield.',
      },
    ],
    judgements: { icpFit: 22, signalStrength: 16, commercialRelevance: 13 },
    whyNow:
      'US sales are up fivefold year on year and in August 2026 Maeving took £3m of UKEF-backed finance to fund the capacity behind it. Arrangements set up when they started exporting in 2023 are now carrying several times the volume, through tariffs.',
    salesAngle:
      "Your US sales are up fivefold and you've just funded the capacity to go further. Worth checking whether your shipping was priced for 2023 volumes or today's — and we can look at the Class 9 battery documentation while we're there.",
  },

  'baltex.co.uk': {
    trigger: 'new_market_entry',
    whatChanged:
      'Targeting the USA following Boeing approval, alongside a seven-figure HSBC package funding EU trade flows and a stated 20% export growth target. Exports are already 60% of the business.',
    polarity: 'demand_increasing',
    polarityRationale:
      'A newly qualified US aerospace lane is freight that does not yet exist, on top of a stated 20% volume increase on existing routes.',
    consequence: {
      actionable: true,
      rationale: 'A greenfield export lane needs routing, customs and traceability arrangements made now.',
    },
    claims: [
      claim({
        id: 'v5-baltex-c1',
        claimText:
          'Baltex received a seven-figure HSBC UK package to support its growth strategy and expand its European operations, having set up a Polish subsidiary in 2008 as a hub for European growth.',
        passage:
          'Baltex has received a seven-figure funding package from HSBC UK to support its growth strategy and expand its European operations. In 2008 Baltex set up a subsidiary company in Poland which acts as a hub for business growth in the heart of Europe.',
        url: 'https://innovationintextiles.com/baltex-accelerates-growth-with-hsbc-uk-support/',
        topic: 'funding',
        publicationDate: '2026-07-20',
        eventDate: '2026-07-20',
        stated: {
          statedName: 'Baltex',
          statedGeography: { country: UK, town: 'Ilkeston' },
          statedIndustry: 'technical textiles',
        },
        confidence: 0.85,
        originId: 'hsbc-baltex-release',
      }),
      claim({
        id: 'v5-baltex-c2',
        claimText:
          'Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months; exports are 60% of the business, with agents in Hong Kong, Italy, Finland and the USA.',
        passage:
          'Baltex is producing more and more of its specialist textiles in the UK for export and is now also targeting the USA market following an approval from aircraft manufacturer Boeing. Exports account for 60% of the business and Baltex is targeting export growth of approximately 20% during the next year. The company works with agents in Hong Kong, Italy, Finland and the USA.',
        url: 'https://knittingindustry.com/uks-baltex-accelerates-international-strategy/',
        topic: 'export_trade',
        publicationDate: '2026-07-20',
        eventDate: '2026-07-20',
        stated: {
          statedName: 'Baltex',
          statedGeography: { country: UK, town: 'Ilkeston' },
          statedIndustry: 'technical textiles',
        },
        confidence: 0.85,
      }),
      // NEW in v5 — surfaced by the expansion family query. Same HSBC release,
      // so it corroborates without adding independence, and carries the origin
      // id that says so.
      claim({
        id: 'v5-baltex-c3',
        claimText:
          'The HSBC funding is being spent on three new appointments and on replacing three legacy machines with AI-integrated equipment, with spending divided between the Ilkeston base and the Polish operation.',
        passage:
          'The funding has enabled the company to expand its workforce with three new appointments and begin modernising production by replacing three legacy machines with AI-integrated equipment, with spending divided between the Ilkeston manufacturing base and the Polish operation.',
        url: 'https://www.themanufacturer.com/articles/baltex-secures-seven-figure-funding-to-drive-european-expansion/',
        topic: 'premises',
        publicationDate: '2026-07-20',
        eventDate: '2026-07-20',
        stated: {
          statedName: 'Baltex',
          statedGeography: { country: UK, town: 'Ilkeston' },
          statedIndustry: 'technical textiles manufacturing',
        },
        confidence: 0.8,
        originId: 'hsbc-baltex-release',
      }),
    ],
    inferences: [
      inf(
        'v5-baltex-i1',
        'A Boeing approval opens a US aerospace lane that did not previously exist, on top of a fifth more volume across EU and UK–Poland routes in a business already 60% export.',
        ['v5-baltex-c1', 'v5-baltex-c2', 'v5-baltex-c3'],
        'The approval is the qualifying event; the funding and the 20% target are the volume behind it, split across two manufacturing sites.',
      ),
    ],
    hypothesis: hyp(
      'v5-baltex-h1',
      'A brand-new US aerospace lane needs freight and customs arrangements that do not exist yet, with traceability requirements beyond ordinary export paperwork.',
      ['v5-baltex-i1'],
      'A first shipment into a regulated sector is decided before it ships, not after.',
      'Ask whether US shipments have started and who handled the first ones — before it is handled this is open, after it is displacement.',
    ),
    owningFunction: {
      function: 'Operations / Supply Chain',
      rationale: 'Export routing and customs sit with operations in a manufacturer of this size.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Ilkeston technical textiles manufacturer, 60% export, two manufacturing sites in the UK and Poland.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note: 'Multiple outlets carried this from one HSBC release — one independent source. At 60% export with agents in four territories, incumbent freight relationships certainly exist; only the US aerospace lane is genuinely new.',
      },
    ],
    judgements: { icpFit: 23, signalStrength: 18, commercialRelevance: 14 },
    whyNow:
      'Baltex has cleared Boeing approval and named the USA as a new target market, on top of a July 2026 HSBC package funding EU trade and a 20% export growth target. A US aerospace lane is a route they have not shipped before.',
    salesAngle:
      "Boeing approval opens a US lane you haven't run before. First shipments into an aerospace supply chain are where documentation and traceability trip people up — worth a conversation before the first one goes.",
  },

  'devolkitchens.com': {
    trigger: 'new_market_entry',
    whatChanged:
      'Established new overseas markets in Thailand, China and Denmark, with 31% of sales exported and overseas revenue up 2,300% over six years.',
    polarity: 'demand_increasing',
    polarityRationale:
      'Newly opened Asian and Nordic lanes require crating, consolidation and customs decisions the existing US-focused arrangement was not built for.',
    consequence: {
      actionable: true,
      rationale: 'New destinations mean new routing and packing decisions being made now.',
    },
    claims: [
      claim({
        id: 'v5-devol-c1',
        claimText:
          'deVOL has grown overseas revenue by 2,300% over six years, with 31% of sales exported, and has been awarded a King’s Award for Enterprise for International Trade.',
        passage:
          "deVOL Kitchens has been honoured with a King's Award for Enterprise for International Trade for outstanding continuous growth in overseas sales. From virtually no exports, deVOL has grown overseas revenue by 2,300% over the last 6 years, with 31% of sales now exported and total turnover and net profits increasing almost three-fold.",
        url: 'https://www.devolkitchens.com/blog/we-won-a-kings-award',
        topic: 'export_trade',
        publicationDate: '2026-05-06',
        eventDate: '2026-05-06',
        stated: {
          statedName: 'deVOL Kitchens',
          statedGeography: { country: UK, region: 'Leicestershire' },
          statedIndustry: 'kitchen manufacturing',
        },
        confidence: 0.9,
      }),
      // NEW in v5 — the first-party sweep reached deVOL's own journal on both
      // owned domains. Undated on the page, so no event date is asserted.
      claim({
        id: 'v5-devol-c2',
        claimText:
          'deVOL has completed projects in 26 countries and sends its furniture all over the world, with every kitchen still made in Leicestershire. The source states no date.',
        passage:
          'deVOL specialises in traditional English kitchens but sends its furniture all over the world, having completed projects in 26 countries.',
        url: 'https://www.devolkitchens.co.uk/blog/overseas-kitchen-projects-faqs',
        topic: 'export_trade',
        stated: {
          statedName: 'deVOL Kitchens',
          statedGeography: { country: UK, region: 'Leicestershire' },
          statedIndustry: 'kitchen manufacturing and retail',
        },
        confidence: 0.85,
      }),
      claim({
        id: 'v5-devol-c3',
        claimText:
          'The All-In-One Island by deVOL has launched in Taipei. The source states no date.',
        passage: 'The All-In-One Island by deVOL launches in Taipei.',
        url: 'https://www.devolkitchens.co.uk/blog/the-all-in-one-island-by-devol-launches-in-taipei',
        topic: 'export_trade',
        stated: {
          statedName: 'deVOL',
          statedGeography: { country: 'Taiwan', town: 'Taipei' },
          statedIndustry: 'kitchen furniture',
        },
        confidence: 0.6,
      }),
      claim({
        id: 'v5-devol-c4',
        claimText:
          'deVOL Kitchens bought the 40,000 sq ft former Karl Mayer factory on Kings Road, Shepshed for £1.95m, with more than 37,000 sq ft of industrial space, a mezzanine and a loading yard, and planned to install CNC and computer-controlled spraying and sanding machines. The source states no date.',
        passage:
          'The former Karl Mayer head office on Kings Road in Shepshed was sold to deVOL Kitchens, which bought the 40,000 sq ft Karl Mayer knitting machine factory for £1.95m.',
        url: 'https://www.matherjamie.co.uk/latest-news/luxury-kitchen-supplier-s-expansion-is-a-recipe-for-success/',
        topic: 'premises',
        stated: {
          statedName: 'deVOL Kitchens',
          statedGeography: { country: UK, region: 'Leicestershire', town: 'Shepshed' },
          statedIndustry: 'kitchen manufacturing',
        },
        confidence: 0.75,
      }),
    ],
    inferences: [
      inf(
        'v5-devol-i1',
        'New lanes to Thailand, China and Denmark have been opened recently, alongside an established US flow, for bulky fragile cabinetry made in Leicestershire.',
        ['v5-devol-c1', 'v5-devol-c2', 'v5-devol-c3'],
        'The export growth is the company’s own claim, and the Taipei launch is its own announcement of an Asian market.',
      ),
    ],
    hypothesis: hyp(
      'v5-devol-h1',
      'Newly opened Asian and Nordic lanes mean crating, consolidation and customs decisions being made now for destinations the existing US-focused arrangement was not built for.',
      ['v5-devol-i1'],
      'A destination that has never been shipped to has no arrangement yet, and export packing decides whether fragile cabinetry arrives saleable.',
      'Ask who is handling the Thailand and China consignments and whether that is the same arrangement as the US.',
    ),
    owningFunction: {
      function: 'Operations / Logistics',
      rationale: 'Crating and despatch decisions sit with operations at a manufacturer of this size.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Loughborough manufacturer of bulky, fragile, high-value goods, exporting 31% of sales, two miles from Orbital.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note: 'A long-established exporter with 31% of sales overseas certainly has incumbent forwarders. The new-market element is what is fresh; the award itself is not a trigger.',
      },
      {
        severity: 'caveat',
        note: 'The Shepshed factory purchase and the Taipei launch are undated in available sources and are carried as context, not as the trigger.',
      },
    ],
    judgements: { icpFit: 23, signalStrength: 15, commercialRelevance: 13 },
    whyNow:
      'deVOL has established new overseas markets in Thailand, China and Denmark on top of 31% of sales already exported. Those are lanes nobody has set up yet, for a product where crating decides whether it arrives saleable.',
    salesAngle:
      "You've opened Thailand, China and Denmark on top of the US business. Those routes crate and consolidate differently to New York — and we're at the other end of Loughborough if you want someone to look at a load before it ships.",
  },

  'bramblefoods.co.uk': {
    trigger: 'new_premises',
    whatChanged:
      'Opened Lancaster House, a 67,000 sq ft main UK distribution hub, while continuing an acquisitive strategy (Whitakers Chocolates January 2025, The Bay Tree January 2024).',
    polarity: 'demand_increasing',
    polarityRationale:
      'The new hub closes the storage opportunity but a widening brand portfolio increases outbound despatch and seasonal peak load.',
    consequence: {
      actionable: true,
      rationale: 'Outbound haulage and Q4 overflow grow even though third-party storage does not.',
    },
    claims: [
      claim({
        id: 'v5-bramble-c1',
        claimText:
          'Bramble Foods opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park, Market Harborough, which becomes its main UK distribution hub.',
        passage:
          'Bramble Foods has opened a new 67,000 sq ft national distribution centre in Market Harborough, moving into Lancaster House at Airfield Business Park, a purpose-built facility developed by Leicestershire County Council. The site becomes Bramble Foods’ main UK distribution hub, increasing warehousing and stockholding capacity.',
        url: 'https://www.grocerygazette.co.uk/2026/07/31/bramble-foods-opens-new-distribution-hub-and-eyes-expansion/',
        topic: 'premises',
        publicationDate: '2026-07-31',
        eventDate: '2026-07-31',
        stated: {
          statedName: 'Bramble Foods',
          statedGeography: { country: UK, region: 'Leicestershire', town: 'Market Harborough' },
          statedIndustry: 'fine food manufacturing and distribution',
        },
        confidence: 0.95,
      }),
      claim({
        id: 'v5-bramble-c2',
        claimText:
          'In July 2026 Bramble expanded into Lancaster House; in January 2025 it acquired Whitakers Chocolates and in January 2024 The Bay Tree Food Co.',
        passage:
          'In July 2026 the business expanded into Lancaster House, a purpose-built 67,000 sq ft distribution centre at Airfield Business Park, Market Harborough. In January 2025 Bramble acquired Yorkshire-based Whitakers Chocolates; in January 2024 it acquired The Bay Tree Food Co.',
        url: 'https://bramblefoods.com/',
        topic: 'corporate_identity',
        stated: {
          statedName: 'Bramble Foods',
          statedGeography: { country: UK, region: 'Leicestershire', town: 'Market Harborough' },
          statedIndustry: 'fine food manufacturing',
        },
        confidence: 0.85,
      }),
      // NEW in v5 — surfaced by the relocation family query. Lancaster House is
      // the company's THIRD base in the town, which is a different operational
      // picture from a single consolidated hub.
      claim({
        id: 'v5-bramble-c3',
        claimText:
          'Lancaster House is Bramble Foods’ third base in Market Harborough, an investment of around half a million pounds, taken so the company could keep growing in the town rather than look elsewhere for larger premises.',
        passage:
          'Bramble Foods moved into Lancaster House at Airfield Business Park, which is the company’s third base in the town. The move represented an investment of around half a million pounds and allowed the company to continue growing in Market Harborough, avoiding the need to look elsewhere for larger premises.',
        url: 'https://www.harboroughmail.co.uk/business/harborough-based-food-manufacturer-and-distributor-moves-to-new-bigger-base-on-the-edge-of-town-potentially-creating-more-jobs-in-the-process-8832307',
        topic: 'premises',
        stated: {
          statedName: 'Bramble Foods',
          statedGeography: { country: UK, region: 'Leicestershire', town: 'Market Harborough' },
          statedIndustry: 'food manufacturing and distribution',
        },
        confidence: 0.8,
      }),
      claim({
        id: 'v5-bramble-c4',
        claimText:
          'Bramble Group employs around 300 people and expects Lancaster House to support up to 50 new skilled roles, taking the workforce towards 350.',
        passage:
          'Bramble Foods is set to create 50 new jobs following the opening of its new national distribution centre in Market Harborough. Bramble Group employs around 300 people and expects to increase its workforce to 350 over the coming years.',
        url: 'https://www.themanufacturer.com/articles/bramble-foods-expansion-to-create-50-new-jobs-in-leicestershire/',
        topic: 'hiring',
        stated: {
          statedName: 'Bramble Group',
          statedGeography: { country: UK, region: 'Leicestershire' },
          statedIndustry: 'food manufacturing',
        },
        confidence: 0.8,
      }),
    ],
    inferences: [
      inf(
        'v5-bramble-i1',
        'Core warehousing is solved in-house, so storage is closed; what grows is outbound despatch across a widening brand portfolio.',
        ['v5-bramble-c1', 'v5-bramble-c2', 'v5-bramble-c3', 'v5-bramble-c4'],
        'The hub is the company’s own building, and the acquisitions and headcount plan are the volume moving through it.',
      ),
    ],
    hypothesis: hyp(
      'v5-bramble-h1',
      'The opportunity is outbound haulage and seasonal peak overflow rather than storage — a hub sized for the average will be tested by a food-gifting Q4 across three acquired brands.',
      ['v5-bramble-i1'],
      'Food gifting peaks hard in Q4 and a building sized for the average year is the wrong size in November.',
      'Ask what they did for overflow last November and whether Lancaster House changes that answer.',
    ),
    owningFunction: {
      function: 'Operations / Distribution',
      rationale: 'Warehousing and despatch decisions sit with the operations function here.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Market Harborough food manufacturer and distributor of physical goods, expanding by acquisition.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note: 'The signal is a company solving its own warehousing problem, which closes the obvious storage pitch. Survives on peak overflow and outbound haulage.',
      },
    ],
    judgements: { icpFit: 20, signalStrength: 13, commercialRelevance: 11 },
    whyNow:
      'Bramble opened its main UK distribution hub on 31 July while integrating two acquisitions. The building is sized for the average; food gifting is not an average business in Q4.',
    salesAngle:
      "You've just opened Lancaster House, so storage isn't the conversation. Overflow and vehicles for the Christmas peak across three brands might be — and that's a September conversation, not a December one.",
  },

  /**
   * NEW IN v5. In v4 this company returned `no_trigger_found` on two template
   * queries. The first-party sweep reached its own site and the delivery
   * programme is stated there.
   *
   * Two things the sweep found have to be reported together, because the
   * second is the answer to the first's "who handles it now?":
   *
   *   1. NMSI is under contract to build 22 district hospitals with work
   *      underway on 12 sites and over 1,000,000 sq ft under construction.
   *   2. NMSI runs its OWN UK central warehouse next to its headquarters,
   *      staffed by an NMSI Logistics team doing pre-shipment testing and QC
   *      before containerisation.
   *
   * Reporting (1) without (2) would sell a project-logistics opportunity that
   * the company has already built in-house. The hypothesis is written against
   * the leg that is still bought.
   *
   * DATES: the programme statement carries no date on the page and none is
   * asserted for it. The dated corroboration is the June 2024 FEBE listing.
   */
  'nmsinfrastructure.com': {
    trigger: 'project_delivery_programme',
    whatChanged:
      'Under contract to build 22 district hospitals across Sub-Saharan Africa with work underway on 12 sites and over 1,000,000 sq ft under construction, consolidated through a UK export warehouse the company operates itself.',
    polarity: 'demand_increasing',
    polarityRationale:
      'An active multi-site build programme in Sub-Saharan Africa moves plant, building materials and fit-out continuously; the volume is project cargo, not pallets.',
    consequence: {
      actionable: true,
      rationale:
        'Containerised movements and destination customs for 12 live African sites still have to be bought, even though consolidation and pre-shipment QC are done in-house.',
    },
    claims: [
      claim({
        id: 'v5-nms-c1',
        claimText:
          'NMSI is under contract to build 22 district hospitals for Africa with work underway on 12 sites and over 1,000,000 sq ft under construction. The company states this on its own site without a date.',
        passage:
          "NMSI is under contract to build 22 state of the art district hospitals for Africa with work underway on 12 sites, and with over 1,000,000 sq ft under construction, NMSI's healthcare upgrade programme is one of the largest multi-site light steel frame construction programmes ever undertaken in Africa.",
        url: 'https://www.nmsinfrastructure.com/?p2df',
        topic: 'contract_win',
        stated: {
          statedName: 'NMSI',
          statedGeography: { country: UK, region: 'Leicestershire', town: 'Market Harborough' },
          statedIndustry: 'infrastructure EPCF development',
        },
        confidence: 0.9,
      }),
      claim({
        id: 'v5-nms-c2',
        claimText:
          'NMS International Group was listed on the 2024 FEBE Growth 100, with its Deputy Chairman stating the past year had seen a record number of hospital completions.',
        passage:
          'NMSI was listed on the 2024 FEBE Growth 100. Frederik Hsu, Deputy Chairman of NMS International Group, commented that the past year has seen a record number of hospital completions.',
        url: 'https://www.nmsinfrastructure.com/blog/2024/6/15/utl8varlpt2jx4og3k6i8ul3n2fbis',
        topic: 'financials',
        publicationDate: '2024-06-15',
        eventDate: '2024-06-15',
        stated: {
          statedName: 'NMS International Group',
          statedGeography: { country: UK, region: 'Leicestershire', town: 'Market Harborough' },
          statedIndustry: 'infrastructure development',
        },
        confidence: 0.85,
      }),
      claim({
        id: 'v5-nms-c3',
        claimText:
          'NMS Infrastructure operates an industrial warehouse next to its Market Harborough headquarters handling export cargoes for sub-Saharan African projects, staffed by an NMSI Logistics team carrying out pre-shipment testing and quality control before containerisation and shipment.',
        passage:
          'NMS Infrastructure launched a new industrial warehouse facility adjacent to its headquarters in Market Harborough to handle export cargoes for projects in sub-Saharan Africa. The warehouse is staffed by NMSI Logistics team members who carry out pre-shipment testing and quality control inspections on equipment prior to containerisation and shipment.',
        url: 'https://www.nmsinfrastructure.com/blog/2022/6/28/nms-inaugurates-new-warehouse',
        topic: 'premises',
        publicationDate: '2022-06-28',
        eventDate: '2022-06-28',
        stated: {
          statedName: 'NMS Infrastructure',
          statedGeography: { country: UK, region: 'Leicestershire', town: 'Market Harborough' },
          statedIndustry: 'infrastructure development',
        },
        confidence: 0.85,
      }),
    ],
    inferences: [
      inf(
        'v5-nms-i1',
        'A live 12-site build programme in Sub-Saharan Africa generates continuous outbound project cargo — plant, steel frame, fit-out and medical equipment — consolidated through a UK warehouse the company staffs itself.',
        ['v5-nms-c1', 'v5-nms-c2', 'v5-nms-c3'],
        'The company states the site count and the square footage under construction, and separately states that it consolidates and QCs the export cargo in-house.',
      ),
    ],
    hypothesis: hyp(
      'v5-nms-h1',
      'The in-house warehouse covers consolidation and pre-shipment QC, which means the leg still being bought is the international movement itself — ocean and air freight, oversized and mixed loads, and destination customs for African ports with awkward regimes.',
      ['v5-nms-i1'],
      'A company that built its own export warehouse has decided how cargo is prepared, not who carries it.',
      'Ask who moves the containers once they leave Market Harborough, whether that is tendered per project or held on a standing arrangement, and whether the freight leg is inside the EPCF financing.',
    ),
    owningFunction: {
      function: 'Project Logistics / Supply Chain',
      rationale:
        'The company names an NMSI Logistics team, so the freight decision sits with an identified internal function rather than with general procurement.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Market Harborough EPCF developer shipping project cargo to Sub-Saharan Africa — oversized, mixed and document-heavy freight, which is the specialist end of what Orbital sells.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note: 'The company runs its own export warehouse with its own logistics team, so this is not an unserved need. The pitch is the international leg, not project logistics as a whole.',
      },
      {
        severity: 'caveat',
        note: 'The programme statement on the company site carries no date. The only dated corroboration found is the June 2024 FEBE listing, so how much of the 22-hospital programme remains to be delivered is not established.',
      },
      {
        severity: 'caveat',
        note: 'EPCF means the company arranges the financing as well as the build; freight may already be committed inside the facility rather than bought on the open market.',
      },
    ],
    judgements: { icpFit: 24, signalStrength: 17, commercialRelevance: 14 },
    whyNow:
      'Twelve hospital sites are under construction now, with over a million square feet in progress. Every one of them needs plant, steel and equipment landed on a remote African site.',
    salesAngle:
      'You consolidate and QC your own export cargo at Market Harborough, so this is not about your warehouse. It is about who carries the containers from there to twelve live sites, and who clears them at the far end.',
  },

  // Researched across nine queries including a first-party sweep. Every event
  // found is 2015-2023: the Illuma House warehouse (June 2015), the Advanced
  // Machining Facility (2016), the Quaser acquisition (2020), the Technology
  // Centre plan (2023), and one undated supplier case study describing a
  // relocation. No dated current commercial change. The negative is retained.
  'winbrogroup.com': null,

  'slackandparr.com': {
    trigger: 'contraction',
    whatChanged:
      'Considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, tariffs in new export markets and rising domestic costs.',
    polarity: 'demand_reducing',
    polarityRationale:
      'Falling overseas demand and an active cost reduction mean fewer shipments, not more — the change is real and current but points the wrong way for a freight forwarder.',
    consequence: {
      actionable: false,
      rationale:
        'Export volumes are contracting and cost is being cut, so freight demand is falling — there is nothing here for a freight forwarder to sell into. Recorded as a real, current signal with negative polarity rather than discarded: a cost-reduction or restructuring vendor would read the same change as an opportunity.',
    },
    claims: [
      claim({
        id: 'v5-slackparr-c1',
        claimText:
          'Slack & Parr is consulting on the loss of up to 40 roles at Kegworth, citing slowing Chinese and Far East investment, tariffs in new export markets and rising domestic costs.',
        passage:
          'Slack & Parr is consulting on the loss of up to 40 roles at its Kegworth facility, citing slowing Chinese and Far East investment, tariffs in new export markets and rising domestic costs.',
        url: 'https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility',
        topic: 'restructuring',
        // Date carried across from the v3 capture of this same URL, which
        // stated it. The v5 snippet does not, and nothing is inferred.
        publicationDate: '2026-08-20',
        eventDate: '2026-08-20',
        stated: {
          statedName: 'Slack & Parr',
          statedGeography: { country: UK, town: 'Kegworth' },
          statedIndustry: 'precision pump manufacturing',
        },
        confidence: 0.9,
      }),
      // NEW in v5 — the first-party sweep and the contract family query found
      // the 2023 administration and Avingtrans acquisition, which the v4 run
      // never saw. It is context for the contraction, not a separate trigger.
      claim({
        id: 'v5-slackparr-c2',
        claimText:
          'Slack & Parr entered administration on 3 July 2023 following ongoing losses and funding issues, and Hayward Tyler Fluid Handling, a subsidiary of Avingtrans, purchased it out of administration in August 2023 together with its USA and China subsidiaries.',
        passage:
          "Hayward Tyler Fluid Handling Limited, a subsidiary of Avingtrans PLC, purchased Slack & Parr Limited out of administration in August 2023, ensuring continuation of operations at the Kegworth base and protecting 100 roles. The deal incorporated Slack & Parr's trading subsidiaries in the USA and China. Slack & Parr entered administration on 3 July 2023 following ongoing losses and funding issues.",
        url: 'https://www.scottishfinancialnews.com/articles/glasgow-based-hayward-tyler-buys-slack-parr-out-of-administration',
        topic: 'corporate_identity',
        publicationDate: '2023-08-01',
        eventDate: '2023-08-01',
        stated: {
          statedName: 'Slack & Parr',
          statedGeography: { country: UK, town: 'Kegworth' },
          statedIndustry: 'precision pump manufacturing',
        },
        confidence: 0.85,
      }),
    ],
    inferences: [
      inf(
        'v5-slackparr-i1',
        'Export volumes to their principal overseas markets are falling, not rising, and the cost base is under active reduction three years after a distressed sale.',
        ['v5-slackparr-c1', 'v5-slackparr-c2'],
        'Redundancy consultation attributed to slowing overseas investment and tariffs describes contracting trade, and the 2023 administration establishes that the pressure is not new.',
      ),
    ],
    hypothesis: hyp(
      'v5-slackparr-h1',
      'Shipping volume is contracting and cost is being cut, so this is a supplier-squeeze situation rather than a buying situation for a freight forwarder.',
      ['v5-slackparr-i1'],
      'A company reducing headcount because export demand fell is not about to add a logistics supplier.',
      'Revisit if export volumes recover or the restructure completes and growth resumes.',
    ),
    owningFunction: {
      function: 'Operations',
      rationale: 'Would own freight if there were freight growth to own; recorded for completeness.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Kegworth precision manufacturer five miles from the client — the profile fits, which is exactly why the negative polarity matters.',
    },
    contradictions: [],
    judgements: { icpFit: 21, signalStrength: 0, commercialRelevance: 0 },
    whyNow: 'n/a — current and well-sourced, but demand-reducing for this client.',
    salesAngle: 'n/a — do not approach on a growth premise.',
  },
};
