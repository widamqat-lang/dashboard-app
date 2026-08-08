import { NextRequest, NextResponse } from "next/server";

// Free BIN Lookup API - BINTable
// Sign up at https://bintable.com for free API key (100 lookups/month)
const BIN_TABLE_API_KEY = process.env.BIN_TABLE_API_KEY || "free";

const cache = new Map<string, { data: any; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

// Map BINTable response to our expected format
function mapBinTableResponse(binTableData: any, bin: string) {
  return {
    BIN: {
      valid: true,
      number: parseInt(bin),
      scheme: binTableData?.card?.scheme || "UNKNOWN",
      brand: binTableData?.card?.brand || binTableData?.card?.scheme || "",
      type: binTableData?.card?.type || "UNKNOWN",
      level: binTableData?.card?.category || "",
      currency: binTableData?.country?.currency_code || "",
      issuer: {
        name: binTableData?.bank?.name || "",
        website: binTableData?.bank?.website || "",
        phone: binTableData?.bank?.phone || ""
      },
      country: {
        country: binTableData?.country?.name || "",
        alpha2: binTableData?.country?.code?.toUpperCase() || "",
        language: ""
      }
    }
  };
}

export async function GET(request: NextRequest) {
  const bin = request.nextUrl.searchParams.get("bin");

  if (!bin || bin.replace(/\s/g, "").length < 6) {
    return NextResponse.json({ error: "BIN يجب أن يكون 6 أرقام على الأقل" }, { status: 400 });
  }

  const cleanBin = bin.replace(/\D/g, "").slice(0, 6);

  // Check cache first
  const cached = cache.get(cleanBin);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  // Try primary free API: BINTable
  try {
    const apiKey = BIN_TABLE_API_KEY === "free" ? "" : BIN_TABLE_API_KEY;
    let url = `https://bintable.com/api/v1/${cleanBin}`;
    if (apiKey) {
      url += `?token=${apiKey}`;
    }
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (response.ok) {
      const binTableData = await response.json();
      if (binTableData?.result === 200 && binTableData?.data) {
        const mappedData = mapBinTableResponse(binTableData.data, cleanBin);
        cache.set(cleanBin, { data: mappedData, expiresAt: Date.now() + TTL_MS });
        return NextResponse.json(mappedData);
      }
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: Use binlist.io (another free API)
  try {
    const response = await fetch(`https://binlist.io/lookup/${cleanBin}/`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (response.ok) {
      const binData = await response.json();
      const mappedData = {
        BIN: {
          valid: true,
          number: parseInt(cleanBin),
          scheme: binData.scheme || "UNKNOWN",
          brand: binData.brand || binData.scheme || "",
          type: binData.type || "UNKNOWN",
          level: binData.category || binData.level || "",
          currency: binData.currency || "",
          issuer: {
            name: binData.bank?.name || "",
            website: binData.bank?.url || "",
            phone: binData.bank?.phone || ""
          },
          country: {
            country: binData.country?.name || "",
            alpha2: binData.country?.alpha2 || "",
            language: binData.country?.eemoji || ""
          }
        }
      };
      cache.set(cleanBin, { data: mappedData, expiresAt: Date.now() + TTL_MS });
      return NextResponse.json(mappedData);
    }
  } catch {
    // Continue to error
  }

  // If all APIs fail, try local fallback for common Saudi banks
  const saudiBankFallback = getLocalBankInfo(cleanBin);
  if (saudiBankFallback) {
    return NextResponse.json(saudiBankFallback);
  }

  return NextResponse.json({ error: "تعذر جلب معلومات BIN" }, { status: 500 });
}

// Local fallback for common Saudi Arabian bank BINs
function getLocalBankInfo(bin: string) {
  const saudiBanks: Record<string, any> = {
    // Saudi National Bank (Al Ahli)
    "400528": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "SAUDI NATIONAL BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "400529": { scheme: "VISA", type: "CREDIT", level: "GOLD", issuer: { name: "SAUDI NATIONAL BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "400530": { scheme: "VISA", type: "CREDIT", level: "PLATINUM", issuer: { name: "SAUDI NATIONAL BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "428878": { scheme: "VISA", type: "CREDIT", level: "SIGNATURE", issuer: { name: "SAUDI NATIONAL BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "457865": { scheme: "VISA", type: "CREDIT", level: "INFINITE", issuer: { name: "SAUDI NATIONAL BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Al Rajhi Bank
    "470012": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "AL RAJHI BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "479884": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "AL RAJHI BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "479885": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "AL RAJHI BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "448407": { scheme: "VISA", type: "CREDIT", level: "PLATINUM", issuer: { name: "AL RAJHI BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Riyadh Bank
    "456781": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "RIYAD BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "456782": { scheme: "VISA", type: "CREDIT", level: "CLASSIC", issuer: { name: "RIYAD BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "456783": { scheme: "VISA", type: "CREDIT", level: "GOLD", issuer: { name: "RIYAD BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Saudi Fransi Bank
    "402082": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "BANQUE SAUDI FRANSI", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "402083": { scheme: "VISA", type: "CREDIT", level: "CLASSIC", issuer: { name: "BANQUE SAUDI FRANSI", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Bank AlBilad
    "400120": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "BANK ALBILAD", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "424084": { scheme: "VISA", type: "CREDIT", level: "PLATINUM", issuer: { name: "BANK ALBILAD", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Bank AlJazira
    "409072": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "BANK ALJAZIRA", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "409073": { scheme: "VISA", type: "CREDIT", level: "CLASSIC", issuer: { name: "BANK ALJAZIRA", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Saudi Investment Bank
    "407347": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "SAUDI INVESTMENT BANK", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Samba Bank
    "408065": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "SAMBA", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "408066": { scheme: "VISA", type: "CREDIT", level: "CLASSIC", issuer: { name: "SAMBA", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // SABB (Saudi British Bank)
    "409870": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "SABB", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Alinma Bank
    "414931": { scheme: "VISA", type: "DEBIT", level: "CLASSIC", issuer: { name: "ALINMA", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "414932": { scheme: "VISA", type: "CREDIT", level: "CLASSIC", issuer: { name: "ALINMA", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // MADA prefix (Saudi domestic network)
    "966400": { scheme: "MADA", type: "DEBIT", level: "CLASSIC", issuer: { name: "SAUDI DOMESTIC", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    "966401": { scheme: "MADA", type: "DEBIT", level: "CLASSIC", issuer: { name: "SAUDI DOMESTIC", country: { name: "SAUDI ARABIA", alpha2: "SA" } } },
    
    // Mastercard prefixes
    "510000": { scheme: "MASTERCARD", type: "CREDIT", level: "STANDARD", issuer: { name: "UNKNOWN BANK", country: { name: "UNKNOWN", alpha2: "XX" } } },
    "530000": { scheme: "MASTERCARD", type: "DEBIT", level: "STANDARD", issuer: { name: "UNKNOWN BANK", country: { name: "UNKNOWN", alpha2: "XX" } } },
  };

  const bankInfo = saudiBanks[bin];
  if (bankInfo) {
    return {
      BIN: {
        valid: true,
        number: parseInt(bin),
        scheme: bankInfo.scheme,
        brand: bankInfo.scheme,
        type: bankInfo.type,
        level: bankInfo.level,
        currency: "SAR",
        issuer: {
          name: bankInfo.issuer.name,
          website: "",
          phone: ""
        },
        country: {
          country: bankInfo.issuer.country.name,
          alpha2: bankInfo.issuer.country.alpha2,
          language: "ar"
        }
      }
    };
  }

  return null;
}
