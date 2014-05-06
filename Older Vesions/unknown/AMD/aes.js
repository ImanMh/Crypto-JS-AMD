define(function(){

    // <!CDATA[
    /* Modified by Mark Cordell */
    /*
    * routines for AES test page
    * extracted from rijndael.js -- Fritz Schneider's Rijndael Reference Implementation
    * http://www-cse.ucsd.edu/~fritz/rijndael.html
    * see below the original copyright notice
    */

    /* rijndael.js      Rijndael Reference Implementation
    Copyright (c) 2001 Fritz Schneider

    This software is provided as-is, without express or implied warranty.  
    Permission to use, copy, modify, distribute or sell this software, with or
    without fee, for any purpose and by any individual or organization, is hereby
    granted, provided that the above copyright notice and this paragraph appear 
    in all copies. Distribution as a part of an application or binary must
    include the above copyright notice in the documentation and/or other materials
    provided with the application or distribution.


    As the above disclaimer notes, you are free to use this code however you
    want. However, I would request that you send me an email 
    (fritz /at/ cs /dot/ ucsd /dot/ edu) to say hi if you find this code useful
    or instructional. Seeing that people are using the code acts as 
    encouragement for me to continue development. If you *really* want to thank
    me you can buy the book I wrote with Thomas Powell, _JavaScript:
    _The_Complete_Reference_ :)

     This code is an UNOPTIMIZED REFERENCE implementation of Rijndael. 
    If there is sufficient interest I can write an optimized (word-based, 
    table-driven) version, although you might want to consider using a 
    compiled language if speed is critical to your application. As it stands,
    one run of the monte carlo test (10,000 encryptions) can take up to 
    several minutes, depending upon your processor. You shouldn't expect more
    than a few kilobytes per second in throughput.

     Also note that there is very little error checking in these functions. 
    Doing proper error checking is always a good idea, but the ideal 
    implementation (using the instanceof operator and exceptions) requires
    IE5+/NS6+, and I've chosen to implement this code so that it is compatible
    with IE4/NS4. 

     And finally, because JavaScript doesn't have an explicit byte/char data 
    type (although JavaScript 2.0 most likely will), when I refer to "byte" 
    in this code I generally mean "32 bit integer with value in the interval 
    [0,255]" which I treat as a byte.

     See http://www-cse.ucsd.edu/~fritz/rijndael.html for more documentation
    of the (very simple) API provided by this code.

                                                 Fritz Schneider
    fritz at cs.ucsd.edu

    */

    // This function takes an array of bytes (byteArray) and converts them
    // to a hexadecimal string. Array element 0 is found at the beginning of 
    // the resulting string, high nibble first. Consecutive elements follow
    // similarly, for example [16, 255] --> "10ff". The function returns a 
    // string.

    function byteArrayToHex(byteArray) {
        var result = "";
        if (!byteArray)
            return;
        for (var i = 0; i < byteArray.length; i++)
            result += ((byteArray[i] < 16) ? "0" : "") + byteArray[i].toString(16);

        return result;
    }

    function hex2s(hex) {
        var r = '';
        if (hex.indexOf("0x") == 0 || hex.indexOf("0X") == 0) hex = hex.substr(2);

        if (hex.length % 2) hex += '0';

        for (var i = 0; i < hex.length; i += 2)
            r += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        return r;
    }

    /**
    * Encode multi-byte Unicode string into utf-8 multiple single-byte characters 
    * (BMP / basic multilingual plane only) (instance method extending String object).
    *
    * Chars in range U+0080 - U+07FF are encoded in 2 chars, U+0800 - U+FFFF in 3 chars
    *
    * @return encoded string
    */
    String.prototype.encodeUTF8 = function () {
        // use regular expressions & String.replace callback function for better efficiency 
        // than procedural approaches
        var str = this.replace(
        /[\u0080-\u07ff]/g,  // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
        function (c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xc0 | cc >> 6, 0x80 | cc & 0x3f);
        }
      );
        str = str.replace(
        /[\u0800-\uffff]/g,  // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
        function (c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xe0 | cc >> 12, 0x80 | cc >> 6 & 0x3F, 0x80 | cc & 0x3f);
        }
      );
        return str;
    }

    /**
    * Decode utf-8 encoded string back into multi-byte Unicode characters
    * (instance method extending String object).
    *
    * @return decoded string
    */
    String.prototype.decodeUTF8 = function () {
        var str = this.replace(
        /[\u00c0-\u00df][\u0080-\u00bf]/g,                 // 2-byte chars
        function (c) {  // (note parentheses for precence)
            var cc = (c.charCodeAt(0) & 0x1f) << 6 | c.charCodeAt(1) & 0x3f;
            return String.fromCharCode(cc);
        }
      );
        str = str.replace(
        /[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g,  // 3-byte chars
        function (c) {  // (note parentheses for precence)
            var cc = ((c.charCodeAt(0) & 0x0f) << 12) | ((c.charCodeAt(1) & 0x3f) << 6) | (c.charCodeAt(2) & 0x3f);
            return String.fromCharCode(cc);
        }
      );
        return str;
    }

    /**
    * Encode string into Base64, as defined by RFC 4648 [http://tools.ietf.org/html/rfc4648]
    * (instance method extending String object). As per RFC 4648, no newlines are added.
    *
    * @param utf8encode optional parameter, if set to true Unicode string is encoded to UTF8 before 
    *                   conversion to base64; otherwise string is assumed to be 8-bit characters
    * @return           base64-encoded string
    */
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

    String.prototype.encodeBase64 = function (utf8encode) {  // http://tools.ietf.org/html/rfc4648
        utf8encode = (typeof utf8encode == 'undefined') ? false : utf8encode;
        var o1, o2, o3, bits, h1, h2, h3, h4, e = [], pad = '', c, plain, coded;

        plain = utf8encode ? this.encodeUTF8() : this;

        c = plain.length % 3;  // pad string to length of multiple of 3
        if (c > 0) { while (c++ < 3) { pad += '='; plain += '\0'; } }
        // note: doing padding here saves us doing special-case packing for trailing 1 or 2 chars

        for (c = 0; c < plain.length; c += 3) {  // pack three octets into four hexets
            o1 = plain.charCodeAt(c);
            o2 = plain.charCodeAt(c + 1);
            o3 = plain.charCodeAt(c + 2);

            bits = o1 << 16 | o2 << 8 | o3;

            h1 = bits >> 18 & 0x3f;
            h2 = bits >> 12 & 0x3f;
            h3 = bits >> 6 & 0x3f;
            h4 = bits & 0x3f;

            // use hextets to index into b64 string
            e[c / 3] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
        }
        coded = e.join('');  // join() is far faster than repeated string concatenation

        // replace 'A's from padded nulls with '='s
        coded = coded.slice(0, coded.length - pad.length) + pad;

        return coded;
    }

    /**
    * Decode string from Base64, as defined by RFC 4648 [http://tools.ietf.org/html/rfc4648]
    * (instance method extending String object). As per RFC 4648, newlines are not catered for.
    *
    * @param utf8decode optional parameter, if set to true UTF8 string is decoded back to Unicode  
    *                   after conversion from base64
    * @return           decoded string
    */
    String.prototype.decodeBase64 = function (utf8decode) {
        utf8decode = (typeof utf8decode == 'undefined') ? false : utf8decode;
        var o1, o2, o3, h1, h2, h3, h4, bits, d = [], plain, coded;

        coded = utf8decode ? this.decodeUTF8() : this;

        for (var c = 0; c < coded.length; c += 4) {  // unpack four hexets into three octets
            h1 = b64.indexOf(coded.charAt(c));
            h2 = b64.indexOf(coded.charAt(c + 1));
            h3 = b64.indexOf(coded.charAt(c + 2));
            h4 = b64.indexOf(coded.charAt(c + 3));

            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

            o1 = bits >>> 16 & 0xff;
            o2 = bits >>> 8 & 0xff;
            o3 = bits & 0xff;

            d[c / 4] = String.fromCharCode(o1, o2, o3);
            // check for padding
            if (h4 == 0x40) d[c / 4] = String.fromCharCode(o1, o2);
            if (h3 == 0x40) d[c / 4] = String.fromCharCode(o1);
        }
        plain = d.join('');  // join() is far faster than repeated string concatenation

        return utf8decode ? plain.decodeUTF8() : plain;
    }

    function KeyFromString(strKey, keyBitCount) {
        strKey = strKey.encodeUTF8();
        var keyBytes = new Array(keyBitCount / 8);
        var i;
        for (i = 0; i < keyBytes.length && i < strKey.length; i++) {
            keyBytes[i] = strKey.charCodeAt(i);
        }
        for (; i < keyBytes.length; i++) {
            keyBytes[i] = 0;
        }
        return keyBytes;
    }

    // Returns an array containing "howMany" random bytes. YOU SHOULD CHANGE THIS
    // TO RETURN HIGHER QUALITY RANDOM BYTES IF YOU ARE USING THIS FOR A "REAL"
    // APPLICATION.

    function getRandomBytes(howMany) {
        var i;
        var bytes = new Array();
        for (i = 0; i < howMany; i++)
            bytes[i] = Math.round(Math.random() * 255);
        return bytes;
    }

    // strPlaintext: any string
    // strKey: string (real key will be padded or truncated for length)
    // returns: base64 string
    function encryptStr(strPlaintext, strKey) {
        strPlaintext = strToByteArray(strPlaintext.encodeUTF8());

        // make the size of strPlaintext a multiple of the block size (16 bytes for 128 bit).
        var bpb = 128 / 8;
        var i;
        for (i = bpb - (strPlaintext.length % bpb) ; i > 0 && i < bpb; i--)
            strPlaintext[strPlaintext.length] = 0;

        var ct = rijndaelEncrypt(strPlaintext, KeyFromString(strKey, 128), 128, "CBC");
        return byteArrayToStr(ct).encodeBase64();
    }

    // strBase64: base 64 encoded encrypted string
    // strKey: string (real key will be padded or truncated for length)
    // returns: base64 string
    function decryptStr(strBase64, strKey) {
        var pt = rijndaelDecrypt(strToByteArray(strBase64.decodeBase64()), KeyFromString(strKey, 128), 128, "CBC");
        return byteArrayToStr(pt).decodeUTF8();
    }

    function byteArrayToStr(b) {
        var i;
        for (i = 0; i < b.length; i++) b[i] = String.fromCharCode(b[i]);
        for (i = b.length - 1; i >= 0 && String.fromCharCode(0) == b[i]; i--) { }
        b.length = i + 1;
        return b.join('');
    }
    function strToByteArray(s) {
        var i;
        var b = [];
        for (i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
        return b;
    }

    // rijndaelEncrypt(plaintext, key, mode)
    // Encrypts the plaintext using the given key and in the given mode. 
    // The parameter "plaintext" can either be a string or an array of bytes. 
    // The parameter "key" must be an array of key bytes. If you have a hex 
    // string representing the key, invoke hexToByteArray() on it to convert it 
    // to an array of bytes. The third parameter "mode" is a string indicating
    // the encryption mode to use, either "ECB" or "CBC". If the parameter is
    // omitted, ECB is assumed.
    // 
    // An array of bytes representing the cihpertext is returned. To convert 
    // this array to hex, invoke byteArrayToHex() on it. If you are using this 
    // "for real" it is a good idea to change the function getRandomBytes() to 
    // something that returns truly random bits.

    function rijndaelEncrypt(plaintext, key, blockSizeInBits, mode) {
        var i, aBlock;
        var bpb = blockSizeInBits / 8;          // bytes per block
        var ct;                                 // ciphertext

        if (!plaintext || !key)
            return;
        if (key.length * 8 != blockSizeInBits)
            return;
        if (mode == "CBC")
            ct = getRandomBytes(bpb);             // get IV
        else {
            mode = "ECB";
            ct = new Array();
        }

        var expandedKey = new keyExpansion(key);

        for (var block = 0; block < plaintext.length / bpb; block++) {
            aBlock = plaintext.slice(block * bpb, (block + 1) * bpb);
            if (mode == "CBC")
                for (var i = 0; i < bpb; i++)
                    aBlock[i] ^= ct[block * bpb + i];
            ct = ct.concat(AESencrypt(aBlock, expandedKey));
        }

        return ct;
    }

    // rijndaelDecrypt(ciphertext, key, mode)
    // Decrypts the using the given key and mode. The parameter "ciphertext" 
    // must be an array of bytes. The parameter "key" must be an array of key 
    // bytes. If you have a hex string representing the ciphertext or key, 
    // invoke hexToByteArray() on it to convert it to an array of bytes. The
    // parameter "mode" is a string, either "CBC" or "ECB".
    // 
    // An array of bytes representing the plaintext is returned. To convert 
    // this array to a hex string, invoke byteArrayToHex() on it. To convert it 
    // to a string of characters, you can use byteArrayToString().

    function rijndaelDecrypt(ciphertext, key, blockSizeInBits, mode) {
        var bpb = blockSizeInBits / 8;          // bytes per block
        var pt = new Array();                   // plaintext array
        var aBlock;                             // a decrypted block
        var block;                              // current block number

        if (!ciphertext || !key) return;

        if (key.length * 8 != blockSizeInBits)
            return;
        if (!mode)
            mode = "ECB";                         // assume ECB if mode omitted

        var expandedKey = new prepare_decryption(key);

        // work backwards to accomodate CBC mode 
        for (block = (ciphertext.length / bpb) - 1; block > 0; block--) {
            aBlock =
           AESdecrypt(ciphertext.slice(block * bpb, (block + 1) * bpb), expandedKey);
            if (mode == "CBC")
                for (var i = 0; i < bpb; i++)
                    pt[(block - 1) * bpb + i] = aBlock[i] ^ ciphertext[(block - 1) * bpb + i];
            else
                pt = aBlock.concat(pt);
        }

        // do last block if ECB (skips the IV in CBC)
        if (mode == "ECB")
            pt = AESdecrypt(ciphertext.slice(0, bpb), expandedKey).concat(pt);

        return pt;
    }

    /* Rijndael (AES) Encryption
    * Copyright 2005 Herbert Hanewinkel, www.haneWIN.de
    * version 1.1, check www.haneWIN.de for the latest version

    * This software is provided as-is, without express or implied warranty.  
    * Permission to use, copy, modify, distribute or sell this software, with or
    * without fee, for any purpose and by any individual or organization, is hereby
    * granted, provided that the above copyright notice and this paragraph appear 
    * in all copies. Distribution as a part of an application or binary must
    * include the above copyright notice in the documentation and/or other
    * materials provided with the application or distribution.
    */

    // The round constants used in subkey expansion
    var Rcon = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8,
    0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4,
    0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91];

    // Precomputed lookup table for the SBox
    var S = [
    99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171,
    118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164,
    114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113,
    216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226,
    235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214,
    179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203,
    190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69,
    249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245,
    188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68,
    23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42,
    144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73,
    6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109,
    141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37,
    46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62,
    181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225,
    248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223,
    140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187,
    22];

    var T1 = [
    0xa56363c6, 0x847c7cf8, 0x997777ee, 0x8d7b7bf6,
    0x0df2f2ff, 0xbd6b6bd6, 0xb16f6fde, 0x54c5c591,
    0x50303060, 0x03010102, 0xa96767ce, 0x7d2b2b56,
    0x19fefee7, 0x62d7d7b5, 0xe6abab4d, 0x9a7676ec,
    0x45caca8f, 0x9d82821f, 0x40c9c989, 0x877d7dfa,
    0x15fafaef, 0xeb5959b2, 0xc947478e, 0x0bf0f0fb,
    0xecadad41, 0x67d4d4b3, 0xfda2a25f, 0xeaafaf45,
    0xbf9c9c23, 0xf7a4a453, 0x967272e4, 0x5bc0c09b,
    0xc2b7b775, 0x1cfdfde1, 0xae93933d, 0x6a26264c,
    0x5a36366c, 0x413f3f7e, 0x02f7f7f5, 0x4fcccc83,
    0x5c343468, 0xf4a5a551, 0x34e5e5d1, 0x08f1f1f9,
    0x937171e2, 0x73d8d8ab, 0x53313162, 0x3f15152a,
    0x0c040408, 0x52c7c795, 0x65232346, 0x5ec3c39d,
    0x28181830, 0xa1969637, 0x0f05050a, 0xb59a9a2f,
    0x0907070e, 0x36121224, 0x9b80801b, 0x3de2e2df,
    0x26ebebcd, 0x6927274e, 0xcdb2b27f, 0x9f7575ea,
    0x1b090912, 0x9e83831d, 0x742c2c58, 0x2e1a1a34,
    0x2d1b1b36, 0xb26e6edc, 0xee5a5ab4, 0xfba0a05b,
    0xf65252a4, 0x4d3b3b76, 0x61d6d6b7, 0xceb3b37d,
    0x7b292952, 0x3ee3e3dd, 0x712f2f5e, 0x97848413,
    0xf55353a6, 0x68d1d1b9, 0x00000000, 0x2cededc1,
    0x60202040, 0x1ffcfce3, 0xc8b1b179, 0xed5b5bb6,
    0xbe6a6ad4, 0x46cbcb8d, 0xd9bebe67, 0x4b393972,
    0xde4a4a94, 0xd44c4c98, 0xe85858b0, 0x4acfcf85,
    0x6bd0d0bb, 0x2aefefc5, 0xe5aaaa4f, 0x16fbfbed,
    0xc5434386, 0xd74d4d9a, 0x55333366, 0x94858511,
    0xcf45458a, 0x10f9f9e9, 0x06020204, 0x817f7ffe,
    0xf05050a0, 0x443c3c78, 0xba9f9f25, 0xe3a8a84b,
    0xf35151a2, 0xfea3a35d, 0xc0404080, 0x8a8f8f05,
    0xad92923f, 0xbc9d9d21, 0x48383870, 0x04f5f5f1,
    0xdfbcbc63, 0xc1b6b677, 0x75dadaaf, 0x63212142,
    0x30101020, 0x1affffe5, 0x0ef3f3fd, 0x6dd2d2bf,
    0x4ccdcd81, 0x140c0c18, 0x35131326, 0x2fececc3,
    0xe15f5fbe, 0xa2979735, 0xcc444488, 0x3917172e,
    0x57c4c493, 0xf2a7a755, 0x827e7efc, 0x473d3d7a,
    0xac6464c8, 0xe75d5dba, 0x2b191932, 0x957373e6,
    0xa06060c0, 0x98818119, 0xd14f4f9e, 0x7fdcdca3,
    0x66222244, 0x7e2a2a54, 0xab90903b, 0x8388880b,
    0xca46468c, 0x29eeeec7, 0xd3b8b86b, 0x3c141428,
    0x79dedea7, 0xe25e5ebc, 0x1d0b0b16, 0x76dbdbad,
    0x3be0e0db, 0x56323264, 0x4e3a3a74, 0x1e0a0a14,
    0xdb494992, 0x0a06060c, 0x6c242448, 0xe45c5cb8,
    0x5dc2c29f, 0x6ed3d3bd, 0xefacac43, 0xa66262c4,
    0xa8919139, 0xa4959531, 0x37e4e4d3, 0x8b7979f2,
    0x32e7e7d5, 0x43c8c88b, 0x5937376e, 0xb76d6dda,
    0x8c8d8d01, 0x64d5d5b1, 0xd24e4e9c, 0xe0a9a949,
    0xb46c6cd8, 0xfa5656ac, 0x07f4f4f3, 0x25eaeacf,
    0xaf6565ca, 0x8e7a7af4, 0xe9aeae47, 0x18080810,
    0xd5baba6f, 0x887878f0, 0x6f25254a, 0x722e2e5c,
    0x241c1c38, 0xf1a6a657, 0xc7b4b473, 0x51c6c697,
    0x23e8e8cb, 0x7cdddda1, 0x9c7474e8, 0x211f1f3e,
    0xdd4b4b96, 0xdcbdbd61, 0x868b8b0d, 0x858a8a0f,
    0x907070e0, 0x423e3e7c, 0xc4b5b571, 0xaa6666cc,
    0xd8484890, 0x05030306, 0x01f6f6f7, 0x120e0e1c,
    0xa36161c2, 0x5f35356a, 0xf95757ae, 0xd0b9b969,
    0x91868617, 0x58c1c199, 0x271d1d3a, 0xb99e9e27,
    0x38e1e1d9, 0x13f8f8eb, 0xb398982b, 0x33111122,
    0xbb6969d2, 0x70d9d9a9, 0x898e8e07, 0xa7949433,
    0xb69b9b2d, 0x221e1e3c, 0x92878715, 0x20e9e9c9,
    0x49cece87, 0xff5555aa, 0x78282850, 0x7adfdfa5,
    0x8f8c8c03, 0xf8a1a159, 0x80898909, 0x170d0d1a,
    0xdabfbf65, 0x31e6e6d7, 0xc6424284, 0xb86868d0,
    0xc3414182, 0xb0999929, 0x772d2d5a, 0x110f0f1e,
    0xcbb0b07b, 0xfc5454a8, 0xd6bbbb6d, 0x3a16162c];

    var T2 = [
    0x6363c6a5, 0x7c7cf884, 0x7777ee99, 0x7b7bf68d,
    0xf2f2ff0d, 0x6b6bd6bd, 0x6f6fdeb1, 0xc5c59154,
    0x30306050, 0x01010203, 0x6767cea9, 0x2b2b567d,
    0xfefee719, 0xd7d7b562, 0xabab4de6, 0x7676ec9a,
    0xcaca8f45, 0x82821f9d, 0xc9c98940, 0x7d7dfa87,
    0xfafaef15, 0x5959b2eb, 0x47478ec9, 0xf0f0fb0b,
    0xadad41ec, 0xd4d4b367, 0xa2a25ffd, 0xafaf45ea,
    0x9c9c23bf, 0xa4a453f7, 0x7272e496, 0xc0c09b5b,
    0xb7b775c2, 0xfdfde11c, 0x93933dae, 0x26264c6a,
    0x36366c5a, 0x3f3f7e41, 0xf7f7f502, 0xcccc834f,
    0x3434685c, 0xa5a551f4, 0xe5e5d134, 0xf1f1f908,
    0x7171e293, 0xd8d8ab73, 0x31316253, 0x15152a3f,
    0x0404080c, 0xc7c79552, 0x23234665, 0xc3c39d5e,
    0x18183028, 0x969637a1, 0x05050a0f, 0x9a9a2fb5,
    0x07070e09, 0x12122436, 0x80801b9b, 0xe2e2df3d,
    0xebebcd26, 0x27274e69, 0xb2b27fcd, 0x7575ea9f,
    0x0909121b, 0x83831d9e, 0x2c2c5874, 0x1a1a342e,
    0x1b1b362d, 0x6e6edcb2, 0x5a5ab4ee, 0xa0a05bfb,
    0x5252a4f6, 0x3b3b764d, 0xd6d6b761, 0xb3b37dce,
    0x2929527b, 0xe3e3dd3e, 0x2f2f5e71, 0x84841397,
    0x5353a6f5, 0xd1d1b968, 0x00000000, 0xededc12c,
    0x20204060, 0xfcfce31f, 0xb1b179c8, 0x5b5bb6ed,
    0x6a6ad4be, 0xcbcb8d46, 0xbebe67d9, 0x3939724b,
    0x4a4a94de, 0x4c4c98d4, 0x5858b0e8, 0xcfcf854a,
    0xd0d0bb6b, 0xefefc52a, 0xaaaa4fe5, 0xfbfbed16,
    0x434386c5, 0x4d4d9ad7, 0x33336655, 0x85851194,
    0x45458acf, 0xf9f9e910, 0x02020406, 0x7f7ffe81,
    0x5050a0f0, 0x3c3c7844, 0x9f9f25ba, 0xa8a84be3,
    0x5151a2f3, 0xa3a35dfe, 0x404080c0, 0x8f8f058a,
    0x92923fad, 0x9d9d21bc, 0x38387048, 0xf5f5f104,
    0xbcbc63df, 0xb6b677c1, 0xdadaaf75, 0x21214263,
    0x10102030, 0xffffe51a, 0xf3f3fd0e, 0xd2d2bf6d,
    0xcdcd814c, 0x0c0c1814, 0x13132635, 0xececc32f,
    0x5f5fbee1, 0x979735a2, 0x444488cc, 0x17172e39,
    0xc4c49357, 0xa7a755f2, 0x7e7efc82, 0x3d3d7a47,
    0x6464c8ac, 0x5d5dbae7, 0x1919322b, 0x7373e695,
    0x6060c0a0, 0x81811998, 0x4f4f9ed1, 0xdcdca37f,
    0x22224466, 0x2a2a547e, 0x90903bab, 0x88880b83,
    0x46468cca, 0xeeeec729, 0xb8b86bd3, 0x1414283c,
    0xdedea779, 0x5e5ebce2, 0x0b0b161d, 0xdbdbad76,
    0xe0e0db3b, 0x32326456, 0x3a3a744e, 0x0a0a141e,
    0x494992db, 0x06060c0a, 0x2424486c, 0x5c5cb8e4,
    0xc2c29f5d, 0xd3d3bd6e, 0xacac43ef, 0x6262c4a6,
    0x919139a8, 0x959531a4, 0xe4e4d337, 0x7979f28b,
    0xe7e7d532, 0xc8c88b43, 0x37376e59, 0x6d6ddab7,
    0x8d8d018c, 0xd5d5b164, 0x4e4e9cd2, 0xa9a949e0,
    0x6c6cd8b4, 0x5656acfa, 0xf4f4f307, 0xeaeacf25,
    0x6565caaf, 0x7a7af48e, 0xaeae47e9, 0x08081018,
    0xbaba6fd5, 0x7878f088, 0x25254a6f, 0x2e2e5c72,
    0x1c1c3824, 0xa6a657f1, 0xb4b473c7, 0xc6c69751,
    0xe8e8cb23, 0xdddda17c, 0x7474e89c, 0x1f1f3e21,
    0x4b4b96dd, 0xbdbd61dc, 0x8b8b0d86, 0x8a8a0f85,
    0x7070e090, 0x3e3e7c42, 0xb5b571c4, 0x6666ccaa,
    0x484890d8, 0x03030605, 0xf6f6f701, 0x0e0e1c12,
    0x6161c2a3, 0x35356a5f, 0x5757aef9, 0xb9b969d0,
    0x86861791, 0xc1c19958, 0x1d1d3a27, 0x9e9e27b9,
    0xe1e1d938, 0xf8f8eb13, 0x98982bb3, 0x11112233,
    0x6969d2bb, 0xd9d9a970, 0x8e8e0789, 0x949433a7,
    0x9b9b2db6, 0x1e1e3c22, 0x87871592, 0xe9e9c920,
    0xcece8749, 0x5555aaff, 0x28285078, 0xdfdfa57a,
    0x8c8c038f, 0xa1a159f8, 0x89890980, 0x0d0d1a17,
    0xbfbf65da, 0xe6e6d731, 0x424284c6, 0x6868d0b8,
    0x414182c3, 0x999929b0, 0x2d2d5a77, 0x0f0f1e11,
    0xb0b07bcb, 0x5454a8fc, 0xbbbb6dd6, 0x16162c3a];

    var T3 = [
    0x63c6a563, 0x7cf8847c, 0x77ee9977, 0x7bf68d7b,
    0xf2ff0df2, 0x6bd6bd6b, 0x6fdeb16f, 0xc59154c5,
    0x30605030, 0x01020301, 0x67cea967, 0x2b567d2b,
    0xfee719fe, 0xd7b562d7, 0xab4de6ab, 0x76ec9a76,
    0xca8f45ca, 0x821f9d82, 0xc98940c9, 0x7dfa877d,
    0xfaef15fa, 0x59b2eb59, 0x478ec947, 0xf0fb0bf0,
    0xad41ecad, 0xd4b367d4, 0xa25ffda2, 0xaf45eaaf,
    0x9c23bf9c, 0xa453f7a4, 0x72e49672, 0xc09b5bc0,
    0xb775c2b7, 0xfde11cfd, 0x933dae93, 0x264c6a26,
    0x366c5a36, 0x3f7e413f, 0xf7f502f7, 0xcc834fcc,
    0x34685c34, 0xa551f4a5, 0xe5d134e5, 0xf1f908f1,
    0x71e29371, 0xd8ab73d8, 0x31625331, 0x152a3f15,
    0x04080c04, 0xc79552c7, 0x23466523, 0xc39d5ec3,
    0x18302818, 0x9637a196, 0x050a0f05, 0x9a2fb59a,
    0x070e0907, 0x12243612, 0x801b9b80, 0xe2df3de2,
    0xebcd26eb, 0x274e6927, 0xb27fcdb2, 0x75ea9f75,
    0x09121b09, 0x831d9e83, 0x2c58742c, 0x1a342e1a,
    0x1b362d1b, 0x6edcb26e, 0x5ab4ee5a, 0xa05bfba0,
    0x52a4f652, 0x3b764d3b, 0xd6b761d6, 0xb37dceb3,
    0x29527b29, 0xe3dd3ee3, 0x2f5e712f, 0x84139784,
    0x53a6f553, 0xd1b968d1, 0x00000000, 0xedc12ced,
    0x20406020, 0xfce31ffc, 0xb179c8b1, 0x5bb6ed5b,
    0x6ad4be6a, 0xcb8d46cb, 0xbe67d9be, 0x39724b39,
    0x4a94de4a, 0x4c98d44c, 0x58b0e858, 0xcf854acf,
    0xd0bb6bd0, 0xefc52aef, 0xaa4fe5aa, 0xfbed16fb,
    0x4386c543, 0x4d9ad74d, 0x33665533, 0x85119485,
    0x458acf45, 0xf9e910f9, 0x02040602, 0x7ffe817f,
    0x50a0f050, 0x3c78443c, 0x9f25ba9f, 0xa84be3a8,
    0x51a2f351, 0xa35dfea3, 0x4080c040, 0x8f058a8f,
    0x923fad92, 0x9d21bc9d, 0x38704838, 0xf5f104f5,
    0xbc63dfbc, 0xb677c1b6, 0xdaaf75da, 0x21426321,
    0x10203010, 0xffe51aff, 0xf3fd0ef3, 0xd2bf6dd2,
    0xcd814ccd, 0x0c18140c, 0x13263513, 0xecc32fec,
    0x5fbee15f, 0x9735a297, 0x4488cc44, 0x172e3917,
    0xc49357c4, 0xa755f2a7, 0x7efc827e, 0x3d7a473d,
    0x64c8ac64, 0x5dbae75d, 0x19322b19, 0x73e69573,
    0x60c0a060, 0x81199881, 0x4f9ed14f, 0xdca37fdc,
    0x22446622, 0x2a547e2a, 0x903bab90, 0x880b8388,
    0x468cca46, 0xeec729ee, 0xb86bd3b8, 0x14283c14,
    0xdea779de, 0x5ebce25e, 0x0b161d0b, 0xdbad76db,
    0xe0db3be0, 0x32645632, 0x3a744e3a, 0x0a141e0a,
    0x4992db49, 0x060c0a06, 0x24486c24, 0x5cb8e45c,
    0xc29f5dc2, 0xd3bd6ed3, 0xac43efac, 0x62c4a662,
    0x9139a891, 0x9531a495, 0xe4d337e4, 0x79f28b79,
    0xe7d532e7, 0xc88b43c8, 0x376e5937, 0x6ddab76d,
    0x8d018c8d, 0xd5b164d5, 0x4e9cd24e, 0xa949e0a9,
    0x6cd8b46c, 0x56acfa56, 0xf4f307f4, 0xeacf25ea,
    0x65caaf65, 0x7af48e7a, 0xae47e9ae, 0x08101808,
    0xba6fd5ba, 0x78f08878, 0x254a6f25, 0x2e5c722e,
    0x1c38241c, 0xa657f1a6, 0xb473c7b4, 0xc69751c6,
    0xe8cb23e8, 0xdda17cdd, 0x74e89c74, 0x1f3e211f,
    0x4b96dd4b, 0xbd61dcbd, 0x8b0d868b, 0x8a0f858a,
    0x70e09070, 0x3e7c423e, 0xb571c4b5, 0x66ccaa66,
    0x4890d848, 0x03060503, 0xf6f701f6, 0x0e1c120e,
    0x61c2a361, 0x356a5f35, 0x57aef957, 0xb969d0b9,
    0x86179186, 0xc19958c1, 0x1d3a271d, 0x9e27b99e,
    0xe1d938e1, 0xf8eb13f8, 0x982bb398, 0x11223311,
    0x69d2bb69, 0xd9a970d9, 0x8e07898e, 0x9433a794,
    0x9b2db69b, 0x1e3c221e, 0x87159287, 0xe9c920e9,
    0xce8749ce, 0x55aaff55, 0x28507828, 0xdfa57adf,
    0x8c038f8c, 0xa159f8a1, 0x89098089, 0x0d1a170d,
    0xbf65dabf, 0xe6d731e6, 0x4284c642, 0x68d0b868,
    0x4182c341, 0x9929b099, 0x2d5a772d, 0x0f1e110f,
    0xb07bcbb0, 0x54a8fc54, 0xbb6dd6bb, 0x162c3a16];

    var T4 = [
    0xc6a56363, 0xf8847c7c, 0xee997777, 0xf68d7b7b,
    0xff0df2f2, 0xd6bd6b6b, 0xdeb16f6f, 0x9154c5c5,
    0x60503030, 0x02030101, 0xcea96767, 0x567d2b2b,
    0xe719fefe, 0xb562d7d7, 0x4de6abab, 0xec9a7676,
    0x8f45caca, 0x1f9d8282, 0x8940c9c9, 0xfa877d7d,
    0xef15fafa, 0xb2eb5959, 0x8ec94747, 0xfb0bf0f0,
    0x41ecadad, 0xb367d4d4, 0x5ffda2a2, 0x45eaafaf,
    0x23bf9c9c, 0x53f7a4a4, 0xe4967272, 0x9b5bc0c0,
    0x75c2b7b7, 0xe11cfdfd, 0x3dae9393, 0x4c6a2626,
    0x6c5a3636, 0x7e413f3f, 0xf502f7f7, 0x834fcccc,
    0x685c3434, 0x51f4a5a5, 0xd134e5e5, 0xf908f1f1,
    0xe2937171, 0xab73d8d8, 0x62533131, 0x2a3f1515,
    0x080c0404, 0x9552c7c7, 0x46652323, 0x9d5ec3c3,
    0x30281818, 0x37a19696, 0x0a0f0505, 0x2fb59a9a,
    0x0e090707, 0x24361212, 0x1b9b8080, 0xdf3de2e2,
    0xcd26ebeb, 0x4e692727, 0x7fcdb2b2, 0xea9f7575,
    0x121b0909, 0x1d9e8383, 0x58742c2c, 0x342e1a1a,
    0x362d1b1b, 0xdcb26e6e, 0xb4ee5a5a, 0x5bfba0a0,
    0xa4f65252, 0x764d3b3b, 0xb761d6d6, 0x7dceb3b3,
    0x527b2929, 0xdd3ee3e3, 0x5e712f2f, 0x13978484,
    0xa6f55353, 0xb968d1d1, 0x00000000, 0xc12ceded,
    0x40602020, 0xe31ffcfc, 0x79c8b1b1, 0xb6ed5b5b,
    0xd4be6a6a, 0x8d46cbcb, 0x67d9bebe, 0x724b3939,
    0x94de4a4a, 0x98d44c4c, 0xb0e85858, 0x854acfcf,
    0xbb6bd0d0, 0xc52aefef, 0x4fe5aaaa, 0xed16fbfb,
    0x86c54343, 0x9ad74d4d, 0x66553333, 0x11948585,
    0x8acf4545, 0xe910f9f9, 0x04060202, 0xfe817f7f,
    0xa0f05050, 0x78443c3c, 0x25ba9f9f, 0x4be3a8a8,
    0xa2f35151, 0x5dfea3a3, 0x80c04040, 0x058a8f8f,
    0x3fad9292, 0x21bc9d9d, 0x70483838, 0xf104f5f5,
    0x63dfbcbc, 0x77c1b6b6, 0xaf75dada, 0x42632121,
    0x20301010, 0xe51affff, 0xfd0ef3f3, 0xbf6dd2d2,
    0x814ccdcd, 0x18140c0c, 0x26351313, 0xc32fecec,
    0xbee15f5f, 0x35a29797, 0x88cc4444, 0x2e391717,
    0x9357c4c4, 0x55f2a7a7, 0xfc827e7e, 0x7a473d3d,
    0xc8ac6464, 0xbae75d5d, 0x322b1919, 0xe6957373,
    0xc0a06060, 0x19988181, 0x9ed14f4f, 0xa37fdcdc,
    0x44662222, 0x547e2a2a, 0x3bab9090, 0x0b838888,
    0x8cca4646, 0xc729eeee, 0x6bd3b8b8, 0x283c1414,
    0xa779dede, 0xbce25e5e, 0x161d0b0b, 0xad76dbdb,
    0xdb3be0e0, 0x64563232, 0x744e3a3a, 0x141e0a0a,
    0x92db4949, 0x0c0a0606, 0x486c2424, 0xb8e45c5c,
    0x9f5dc2c2, 0xbd6ed3d3, 0x43efacac, 0xc4a66262,
    0x39a89191, 0x31a49595, 0xd337e4e4, 0xf28b7979,
    0xd532e7e7, 0x8b43c8c8, 0x6e593737, 0xdab76d6d,
    0x018c8d8d, 0xb164d5d5, 0x9cd24e4e, 0x49e0a9a9,
    0xd8b46c6c, 0xacfa5656, 0xf307f4f4, 0xcf25eaea,
    0xcaaf6565, 0xf48e7a7a, 0x47e9aeae, 0x10180808,
    0x6fd5baba, 0xf0887878, 0x4a6f2525, 0x5c722e2e,
    0x38241c1c, 0x57f1a6a6, 0x73c7b4b4, 0x9751c6c6,
    0xcb23e8e8, 0xa17cdddd, 0xe89c7474, 0x3e211f1f,
    0x96dd4b4b, 0x61dcbdbd, 0x0d868b8b, 0x0f858a8a,
    0xe0907070, 0x7c423e3e, 0x71c4b5b5, 0xccaa6666,
    0x90d84848, 0x06050303, 0xf701f6f6, 0x1c120e0e,
    0xc2a36161, 0x6a5f3535, 0xaef95757, 0x69d0b9b9,
    0x17918686, 0x9958c1c1, 0x3a271d1d, 0x27b99e9e,
    0xd938e1e1, 0xeb13f8f8, 0x2bb39898, 0x22331111,
    0xd2bb6969, 0xa970d9d9, 0x07898e8e, 0x33a79494,
    0x2db69b9b, 0x3c221e1e, 0x15928787, 0xc920e9e9,
    0x8749cece, 0xaaff5555, 0x50782828, 0xa57adfdf,
    0x038f8c8c, 0x59f8a1a1, 0x09808989, 0x1a170d0d,
    0x65dabfbf, 0xd731e6e6, 0x84c64242, 0xd0b86868,
    0x82c34141, 0x29b09999, 0x5a772d2d, 0x1e110f0f,
    0x7bcbb0b0, 0xa8fc5454, 0x6dd6bbbb, 0x2c3a1616];

    function B0(x) { return (x & 255); }
    function B1(x) { return ((x >> 8) & 255); }
    function B2(x) { return ((x >> 16) & 255); }
    function B3(x) { return ((x >> 24) & 255); }

    function F1(x0, x1, x2, x3) {
        return B1(T1[x0 & 255]) | (B1(T1[(x1 >> 8) & 255]) << 8)
          | (B1(T1[(x2 >> 16) & 255]) << 16) | (B1(T1[x3 >>> 24]) << 24);
    }

    function packBytes(octets) {
        var i, j;
        var len = octets.length;
        var b = new Array(len / 4);

        if (!octets || len % 4) return;

        for (i = 0, j = 0; j < len; j += 4)
            b[i++] = octets[j] | (octets[j + 1] << 8) | (octets[j + 2] << 16) | (octets[j + 3] << 24);

        return b;
    }

    function unpackBytes(packed) {
        var j;
        var i = 0, l = packed.length;
        var r = new Array(l * 4);

        for (j = 0; j < l; j++) {
            r[i++] = B0(packed[j]);
            r[i++] = B1(packed[j]);
            r[i++] = B2(packed[j]);
            r[i++] = B3(packed[j]);
        }
        return r;
    }

    // ------------------------------------------------

    var maxkc = 8;
    var maxrk = 14;

    function keyExpansion(key) {
        var kc, i, j, r, t;
        var rounds;
        var keySched = new Array(maxrk + 1);
        var keylen = key.length;
        var k = new Array(maxkc);
        var tk = new Array(maxkc);
        var rconpointer = 0;

        if (keylen == 16) {
            rounds = 10;
            kc = 4;
        }
        else if (keylen == 24) {
            rounds = 12;
            kc = 6
        }
        else if (keylen == 32) {
            rounds = 14;
            kc = 8
        }
        else {
            alert('Invalid key length ' + keylen);
            return;
        }

        for (i = 0; i < maxrk + 1; i++) keySched[i] = new Array(4);

        for (i = 0, j = 0; j < keylen; j++, i += 4)
            k[j] = key[i] | (key[i + 1] << 8)
                           | (key[i + 2] << 16) | (key[i + 3] << 24);

        for (j = kc - 1; j >= 0; j--) tk[j] = k[j];

        r = 0;
        t = 0;
        for (j = 0; (j < kc) && (r < rounds + 1) ;) {
            for (; (j < kc) && (t < 4) ; j++, t++) {
                keySched[r][t] = tk[j];
            }
            if (t == 4) {
                r++;
                t = 0;
            }
        }

        while (r < rounds + 1) {
            var temp = tk[kc - 1];

            tk[0] ^= S[B1(temp)] | (S[B2(temp)] << 8) | (S[B3(temp)] << 16) | (S[B0(temp)] << 24);
            tk[0] ^= Rcon[rconpointer++];

            if (kc != 8) {
                for (j = 1; j < kc; j++) tk[j] ^= tk[j - 1];
            }
            else {
                for (j = 1; j < kc / 2; j++) tk[j] ^= tk[j - 1];

                temp = tk[kc / 2 - 1];
                tk[kc / 2] ^= S[B0(temp)] | (S[B1(temp)] << 8) | (S[B2(temp)] << 16) | (S[B3(temp)] << 24);

                for (j = kc / 2 + 1; j < kc; j++) tk[j] ^= tk[j - 1];
            }

            for (j = 0; (j < kc) && (r < rounds + 1) ;) {
                for (; (j < kc) && (t < 4) ; j++, t++) {
                    keySched[r][t] = tk[j];
                }
                if (t == 4) {
                    r++;
                    t = 0;
                }
            }
        }
        this.rounds = rounds;
        this.rk = keySched;
        return this;
    }

    function AESencrypt(block, ctx) {
        var r;
        var t0, t1, t2, t3;

        var b = packBytes(block);
        var rounds = ctx.rounds;
        var b0 = b[0];
        var b1 = b[1];
        var b2 = b[2];
        var b3 = b[3];

        for (r = 0; r < rounds - 1; r++) {
            t0 = b0 ^ ctx.rk[r][0];
            t1 = b1 ^ ctx.rk[r][1];
            t2 = b2 ^ ctx.rk[r][2];
            t3 = b3 ^ ctx.rk[r][3];

            b0 = T1[t0 & 255] ^ T2[(t1 >> 8) & 255] ^ T3[(t2 >> 16) & 255] ^ T4[t3 >>> 24];
            b1 = T1[t1 & 255] ^ T2[(t2 >> 8) & 255] ^ T3[(t3 >> 16) & 255] ^ T4[t0 >>> 24];
            b2 = T1[t2 & 255] ^ T2[(t3 >> 8) & 255] ^ T3[(t0 >> 16) & 255] ^ T4[t1 >>> 24];
            b3 = T1[t3 & 255] ^ T2[(t0 >> 8) & 255] ^ T3[(t1 >> 16) & 255] ^ T4[t2 >>> 24];
        }

        // last round is special
        r = rounds - 1;

        t0 = b0 ^ ctx.rk[r][0];
        t1 = b1 ^ ctx.rk[r][1];
        t2 = b2 ^ ctx.rk[r][2];
        t3 = b3 ^ ctx.rk[r][3];

        b[0] = F1(t0, t1, t2, t3) ^ ctx.rk[rounds][0];
        b[1] = F1(t1, t2, t3, t0) ^ ctx.rk[rounds][1];
        b[2] = F1(t2, t3, t0, t1) ^ ctx.rk[rounds][2];
        b[3] = F1(t3, t0, t1, t2) ^ ctx.rk[rounds][3];

        return unpackBytes(b);
    }

    /* Rijndael (AES) Decryption
    * Copyright 2005 Herbert Hanewinkel, www.haneWIN.de
    * version 1.0, check www.haneWIN.de for the latest version

    * This software is provided as-is, without express or implied warranty.  
    * Permission to use, copy, modify, distribute or sell this software, with or
    * without fee, for any purpose and by any individual or organization, is hereby
    * granted, provided that the above copyright notice and this paragraph appear 
    * in all copies. Distribution as a part of an application or binary must
    * include the above copyright notice in the documentation and/or other materials
    * provided with the application or distribution.
    */

    // Precomputed lookup table for the inverse SBox
    var S5 = [
    82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215,
    251, 124, 227, 57, 130, 155, 47, 255, 135, 52, 142, 67, 68, 196, 222,
    233, 203, 84, 123, 148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66,
    250, 195, 78, 8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73,
    109, 139, 209, 37, 114, 248, 246, 100, 134, 104, 152, 22, 212, 164, 92,
    204, 93, 101, 182, 146, 108, 112, 72, 80, 253, 237, 185, 218, 94, 21,
    70, 87, 167, 141, 157, 132, 144, 216, 171, 0, 140, 188, 211, 10, 247,
    228, 88, 5, 184, 179, 69, 6, 208, 44, 30, 143, 202, 63, 15, 2,
    193, 175, 189, 3, 1, 19, 138, 107, 58, 145, 17, 65, 79, 103, 220,
    234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116, 34, 231, 173,
    53, 133, 226, 249, 55, 232, 28, 117, 223, 110, 71, 241, 26, 113, 29,
    41, 197, 137, 111, 183, 98, 14, 170, 24, 190, 27, 252, 86, 62, 75,
    198, 210, 121, 32, 154, 219, 192, 254, 120, 205, 90, 244, 31, 221, 168,
    51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95, 96, 81,
    127, 169, 25, 181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160,
    224, 59, 77, 174, 42, 245, 176, 200, 235, 187, 60, 131, 83, 153, 97,
    23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12,
    125];


    var T5 = [
    0x50a7f451, 0x5365417e, 0xc3a4171a, 0x965e273a,
    0xcb6bab3b, 0xf1459d1f, 0xab58faac, 0x9303e34b,
    0x55fa3020, 0xf66d76ad, 0x9176cc88, 0x254c02f5,
    0xfcd7e54f, 0xd7cb2ac5, 0x80443526, 0x8fa362b5,
    0x495ab1de, 0x671bba25, 0x980eea45, 0xe1c0fe5d,
    0x02752fc3, 0x12f04c81, 0xa397468d, 0xc6f9d36b,
    0xe75f8f03, 0x959c9215, 0xeb7a6dbf, 0xda595295,
    0x2d83bed4, 0xd3217458, 0x2969e049, 0x44c8c98e,
    0x6a89c275, 0x78798ef4, 0x6b3e5899, 0xdd71b927,
    0xb64fe1be, 0x17ad88f0, 0x66ac20c9, 0xb43ace7d,
    0x184adf63, 0x82311ae5, 0x60335197, 0x457f5362,
    0xe07764b1, 0x84ae6bbb, 0x1ca081fe, 0x942b08f9,
    0x58684870, 0x19fd458f, 0x876cde94, 0xb7f87b52,
    0x23d373ab, 0xe2024b72, 0x578f1fe3, 0x2aab5566,
    0x0728ebb2, 0x03c2b52f, 0x9a7bc586, 0xa50837d3,
    0xf2872830, 0xb2a5bf23, 0xba6a0302, 0x5c8216ed,
    0x2b1ccf8a, 0x92b479a7, 0xf0f207f3, 0xa1e2694e,
    0xcdf4da65, 0xd5be0506, 0x1f6234d1, 0x8afea6c4,
    0x9d532e34, 0xa055f3a2, 0x32e18a05, 0x75ebf6a4,
    0x39ec830b, 0xaaef6040, 0x069f715e, 0x51106ebd,
    0xf98a213e, 0x3d06dd96, 0xae053edd, 0x46bde64d,
    0xb58d5491, 0x055dc471, 0x6fd40604, 0xff155060,
    0x24fb9819, 0x97e9bdd6, 0xcc434089, 0x779ed967,
    0xbd42e8b0, 0x888b8907, 0x385b19e7, 0xdbeec879,
    0x470a7ca1, 0xe90f427c, 0xc91e84f8, 0x00000000,
    0x83868009, 0x48ed2b32, 0xac70111e, 0x4e725a6c,
    0xfbff0efd, 0x5638850f, 0x1ed5ae3d, 0x27392d36,
    0x64d90f0a, 0x21a65c68, 0xd1545b9b, 0x3a2e3624,
    0xb1670a0c, 0x0fe75793, 0xd296eeb4, 0x9e919b1b,
    0x4fc5c080, 0xa220dc61, 0x694b775a, 0x161a121c,
    0x0aba93e2, 0xe52aa0c0, 0x43e0223c, 0x1d171b12,
    0x0b0d090e, 0xadc78bf2, 0xb9a8b62d, 0xc8a91e14,
    0x8519f157, 0x4c0775af, 0xbbdd99ee, 0xfd607fa3,
    0x9f2601f7, 0xbcf5725c, 0xc53b6644, 0x347efb5b,
    0x7629438b, 0xdcc623cb, 0x68fcedb6, 0x63f1e4b8,
    0xcadc31d7, 0x10856342, 0x40229713, 0x2011c684,
    0x7d244a85, 0xf83dbbd2, 0x1132f9ae, 0x6da129c7,
    0x4b2f9e1d, 0xf330b2dc, 0xec52860d, 0xd0e3c177,
    0x6c16b32b, 0x99b970a9, 0xfa489411, 0x2264e947,
    0xc48cfca8, 0x1a3ff0a0, 0xd82c7d56, 0xef903322,
    0xc74e4987, 0xc1d138d9, 0xfea2ca8c, 0x360bd498,
    0xcf81f5a6, 0x28de7aa5, 0x268eb7da, 0xa4bfad3f,
    0xe49d3a2c, 0x0d927850, 0x9bcc5f6a, 0x62467e54,
    0xc2138df6, 0xe8b8d890, 0x5ef7392e, 0xf5afc382,
    0xbe805d9f, 0x7c93d069, 0xa92dd56f, 0xb31225cf,
    0x3b99acc8, 0xa77d1810, 0x6e639ce8, 0x7bbb3bdb,
    0x097826cd, 0xf418596e, 0x01b79aec, 0xa89a4f83,
    0x656e95e6, 0x7ee6ffaa, 0x08cfbc21, 0xe6e815ef,
    0xd99be7ba, 0xce366f4a, 0xd4099fea, 0xd67cb029,
    0xafb2a431, 0x31233f2a, 0x3094a5c6, 0xc066a235,
    0x37bc4e74, 0xa6ca82fc, 0xb0d090e0, 0x15d8a733,
    0x4a9804f1, 0xf7daec41, 0x0e50cd7f, 0x2ff69117,
    0x8dd64d76, 0x4db0ef43, 0x544daacc, 0xdf0496e4,
    0xe3b5d19e, 0x1b886a4c, 0xb81f2cc1, 0x7f516546,
    0x04ea5e9d, 0x5d358c01, 0x737487fa, 0x2e410bfb,
    0x5a1d67b3, 0x52d2db92, 0x335610e9, 0x1347d66d,
    0x8c61d79a, 0x7a0ca137, 0x8e14f859, 0x893c13eb,
    0xee27a9ce, 0x35c961b7, 0xede51ce1, 0x3cb1477a,
    0x59dfd29c, 0x3f73f255, 0x79ce1418, 0xbf37c773,
    0xeacdf753, 0x5baafd5f, 0x146f3ddf, 0x86db4478,
    0x81f3afca, 0x3ec468b9, 0x2c342438, 0x5f40a3c2,
    0x72c31d16, 0x0c25e2bc, 0x8b493c28, 0x41950dff,
    0x7101a839, 0xdeb30c08, 0x9ce4b4d8, 0x90c15664,
    0x6184cb7b, 0x70b632d5, 0x745c6c48, 0x4257b8d0];

    var T6 = [
    0xa7f45150, 0x65417e53, 0xa4171ac3, 0x5e273a96,
    0x6bab3bcb, 0x459d1ff1, 0x58faacab, 0x03e34b93,
    0xfa302055, 0x6d76adf6, 0x76cc8891, 0x4c02f525,
    0xd7e54ffc, 0xcb2ac5d7, 0x44352680, 0xa362b58f,
    0x5ab1de49, 0x1bba2567, 0x0eea4598, 0xc0fe5de1,
    0x752fc302, 0xf04c8112, 0x97468da3, 0xf9d36bc6,
    0x5f8f03e7, 0x9c921595, 0x7a6dbfeb, 0x595295da,
    0x83bed42d, 0x217458d3, 0x69e04929, 0xc8c98e44,
    0x89c2756a, 0x798ef478, 0x3e58996b, 0x71b927dd,
    0x4fe1beb6, 0xad88f017, 0xac20c966, 0x3ace7db4,
    0x4adf6318, 0x311ae582, 0x33519760, 0x7f536245,
    0x7764b1e0, 0xae6bbb84, 0xa081fe1c, 0x2b08f994,
    0x68487058, 0xfd458f19, 0x6cde9487, 0xf87b52b7,
    0xd373ab23, 0x024b72e2, 0x8f1fe357, 0xab55662a,
    0x28ebb207, 0xc2b52f03, 0x7bc5869a, 0x0837d3a5,
    0x872830f2, 0xa5bf23b2, 0x6a0302ba, 0x8216ed5c,
    0x1ccf8a2b, 0xb479a792, 0xf207f3f0, 0xe2694ea1,
    0xf4da65cd, 0xbe0506d5, 0x6234d11f, 0xfea6c48a,
    0x532e349d, 0x55f3a2a0, 0xe18a0532, 0xebf6a475,
    0xec830b39, 0xef6040aa, 0x9f715e06, 0x106ebd51,
    0x8a213ef9, 0x06dd963d, 0x053eddae, 0xbde64d46,
    0x8d5491b5, 0x5dc47105, 0xd406046f, 0x155060ff,
    0xfb981924, 0xe9bdd697, 0x434089cc, 0x9ed96777,
    0x42e8b0bd, 0x8b890788, 0x5b19e738, 0xeec879db,
    0x0a7ca147, 0x0f427ce9, 0x1e84f8c9, 0x00000000,
    0x86800983, 0xed2b3248, 0x70111eac, 0x725a6c4e,
    0xff0efdfb, 0x38850f56, 0xd5ae3d1e, 0x392d3627,
    0xd90f0a64, 0xa65c6821, 0x545b9bd1, 0x2e36243a,
    0x670a0cb1, 0xe757930f, 0x96eeb4d2, 0x919b1b9e,
    0xc5c0804f, 0x20dc61a2, 0x4b775a69, 0x1a121c16,
    0xba93e20a, 0x2aa0c0e5, 0xe0223c43, 0x171b121d,
    0x0d090e0b, 0xc78bf2ad, 0xa8b62db9, 0xa91e14c8,
    0x19f15785, 0x0775af4c, 0xdd99eebb, 0x607fa3fd,
    0x2601f79f, 0xf5725cbc, 0x3b6644c5, 0x7efb5b34,
    0x29438b76, 0xc623cbdc, 0xfcedb668, 0xf1e4b863,
    0xdc31d7ca, 0x85634210, 0x22971340, 0x11c68420,
    0x244a857d, 0x3dbbd2f8, 0x32f9ae11, 0xa129c76d,
    0x2f9e1d4b, 0x30b2dcf3, 0x52860dec, 0xe3c177d0,
    0x16b32b6c, 0xb970a999, 0x489411fa, 0x64e94722,
    0x8cfca8c4, 0x3ff0a01a, 0x2c7d56d8, 0x903322ef,
    0x4e4987c7, 0xd138d9c1, 0xa2ca8cfe, 0x0bd49836,
    0x81f5a6cf, 0xde7aa528, 0x8eb7da26, 0xbfad3fa4,
    0x9d3a2ce4, 0x9278500d, 0xcc5f6a9b, 0x467e5462,
    0x138df6c2, 0xb8d890e8, 0xf7392e5e, 0xafc382f5,
    0x805d9fbe, 0x93d0697c, 0x2dd56fa9, 0x1225cfb3,
    0x99acc83b, 0x7d1810a7, 0x639ce86e, 0xbb3bdb7b,
    0x7826cd09, 0x18596ef4, 0xb79aec01, 0x9a4f83a8,
    0x6e95e665, 0xe6ffaa7e, 0xcfbc2108, 0xe815efe6,
    0x9be7bad9, 0x366f4ace, 0x099fead4, 0x7cb029d6,
    0xb2a431af, 0x233f2a31, 0x94a5c630, 0x66a235c0,
    0xbc4e7437, 0xca82fca6, 0xd090e0b0, 0xd8a73315,
    0x9804f14a, 0xdaec41f7, 0x50cd7f0e, 0xf691172f,
    0xd64d768d, 0xb0ef434d, 0x4daacc54, 0x0496e4df,
    0xb5d19ee3, 0x886a4c1b, 0x1f2cc1b8, 0x5165467f,
    0xea5e9d04, 0x358c015d, 0x7487fa73, 0x410bfb2e,
    0x1d67b35a, 0xd2db9252, 0x5610e933, 0x47d66d13,
    0x61d79a8c, 0x0ca1377a, 0x14f8598e, 0x3c13eb89,
    0x27a9ceee, 0xc961b735, 0xe51ce1ed, 0xb1477a3c,
    0xdfd29c59, 0x73f2553f, 0xce141879, 0x37c773bf,
    0xcdf753ea, 0xaafd5f5b, 0x6f3ddf14, 0xdb447886,
    0xf3afca81, 0xc468b93e, 0x3424382c, 0x40a3c25f,
    0xc31d1672, 0x25e2bc0c, 0x493c288b, 0x950dff41,
    0x01a83971, 0xb30c08de, 0xe4b4d89c, 0xc1566490,
    0x84cb7b61, 0xb632d570, 0x5c6c4874, 0x57b8d042];

    var T7 = [
    0xf45150a7, 0x417e5365, 0x171ac3a4, 0x273a965e,
    0xab3bcb6b, 0x9d1ff145, 0xfaacab58, 0xe34b9303,
    0x302055fa, 0x76adf66d, 0xcc889176, 0x02f5254c,
    0xe54ffcd7, 0x2ac5d7cb, 0x35268044, 0x62b58fa3,
    0xb1de495a, 0xba25671b, 0xea45980e, 0xfe5de1c0,
    0x2fc30275, 0x4c8112f0, 0x468da397, 0xd36bc6f9,
    0x8f03e75f, 0x9215959c, 0x6dbfeb7a, 0x5295da59,
    0xbed42d83, 0x7458d321, 0xe0492969, 0xc98e44c8,
    0xc2756a89, 0x8ef47879, 0x58996b3e, 0xb927dd71,
    0xe1beb64f, 0x88f017ad, 0x20c966ac, 0xce7db43a,
    0xdf63184a, 0x1ae58231, 0x51976033, 0x5362457f,
    0x64b1e077, 0x6bbb84ae, 0x81fe1ca0, 0x08f9942b,
    0x48705868, 0x458f19fd, 0xde94876c, 0x7b52b7f8,
    0x73ab23d3, 0x4b72e202, 0x1fe3578f, 0x55662aab,
    0xebb20728, 0xb52f03c2, 0xc5869a7b, 0x37d3a508,
    0x2830f287, 0xbf23b2a5, 0x0302ba6a, 0x16ed5c82,
    0xcf8a2b1c, 0x79a792b4, 0x07f3f0f2, 0x694ea1e2,
    0xda65cdf4, 0x0506d5be, 0x34d11f62, 0xa6c48afe,
    0x2e349d53, 0xf3a2a055, 0x8a0532e1, 0xf6a475eb,
    0x830b39ec, 0x6040aaef, 0x715e069f, 0x6ebd5110,
    0x213ef98a, 0xdd963d06, 0x3eddae05, 0xe64d46bd,
    0x5491b58d, 0xc471055d, 0x06046fd4, 0x5060ff15,
    0x981924fb, 0xbdd697e9, 0x4089cc43, 0xd967779e,
    0xe8b0bd42, 0x8907888b, 0x19e7385b, 0xc879dbee,
    0x7ca1470a, 0x427ce90f, 0x84f8c91e, 0x00000000,
    0x80098386, 0x2b3248ed, 0x111eac70, 0x5a6c4e72,
    0x0efdfbff, 0x850f5638, 0xae3d1ed5, 0x2d362739,
    0x0f0a64d9, 0x5c6821a6, 0x5b9bd154, 0x36243a2e,
    0x0a0cb167, 0x57930fe7, 0xeeb4d296, 0x9b1b9e91,
    0xc0804fc5, 0xdc61a220, 0x775a694b, 0x121c161a,
    0x93e20aba, 0xa0c0e52a, 0x223c43e0, 0x1b121d17,
    0x090e0b0d, 0x8bf2adc7, 0xb62db9a8, 0x1e14c8a9,
    0xf1578519, 0x75af4c07, 0x99eebbdd, 0x7fa3fd60,
    0x01f79f26, 0x725cbcf5, 0x6644c53b, 0xfb5b347e,
    0x438b7629, 0x23cbdcc6, 0xedb668fc, 0xe4b863f1,
    0x31d7cadc, 0x63421085, 0x97134022, 0xc6842011,
    0x4a857d24, 0xbbd2f83d, 0xf9ae1132, 0x29c76da1,
    0x9e1d4b2f, 0xb2dcf330, 0x860dec52, 0xc177d0e3,
    0xb32b6c16, 0x70a999b9, 0x9411fa48, 0xe9472264,
    0xfca8c48c, 0xf0a01a3f, 0x7d56d82c, 0x3322ef90,
    0x4987c74e, 0x38d9c1d1, 0xca8cfea2, 0xd498360b,
    0xf5a6cf81, 0x7aa528de, 0xb7da268e, 0xad3fa4bf,
    0x3a2ce49d, 0x78500d92, 0x5f6a9bcc, 0x7e546246,
    0x8df6c213, 0xd890e8b8, 0x392e5ef7, 0xc382f5af,
    0x5d9fbe80, 0xd0697c93, 0xd56fa92d, 0x25cfb312,
    0xacc83b99, 0x1810a77d, 0x9ce86e63, 0x3bdb7bbb,
    0x26cd0978, 0x596ef418, 0x9aec01b7, 0x4f83a89a,
    0x95e6656e, 0xffaa7ee6, 0xbc2108cf, 0x15efe6e8,
    0xe7bad99b, 0x6f4ace36, 0x9fead409, 0xb029d67c,
    0xa431afb2, 0x3f2a3123, 0xa5c63094, 0xa235c066,
    0x4e7437bc, 0x82fca6ca, 0x90e0b0d0, 0xa73315d8,
    0x04f14a98, 0xec41f7da, 0xcd7f0e50, 0x91172ff6,
    0x4d768dd6, 0xef434db0, 0xaacc544d, 0x96e4df04,
    0xd19ee3b5, 0x6a4c1b88, 0x2cc1b81f, 0x65467f51,
    0x5e9d04ea, 0x8c015d35, 0x87fa7374, 0x0bfb2e41,
    0x67b35a1d, 0xdb9252d2, 0x10e93356, 0xd66d1347,
    0xd79a8c61, 0xa1377a0c, 0xf8598e14, 0x13eb893c,
    0xa9ceee27, 0x61b735c9, 0x1ce1ede5, 0x477a3cb1,
    0xd29c59df, 0xf2553f73, 0x141879ce, 0xc773bf37,
    0xf753eacd, 0xfd5f5baa, 0x3ddf146f, 0x447886db,
    0xafca81f3, 0x68b93ec4, 0x24382c34, 0xa3c25f40,
    0x1d1672c3, 0xe2bc0c25, 0x3c288b49, 0x0dff4195,
    0xa8397101, 0x0c08deb3, 0xb4d89ce4, 0x566490c1,
    0xcb7b6184, 0x32d570b6, 0x6c48745c, 0xb8d04257];

    var T8 = [
    0x5150a7f4, 0x7e536541, 0x1ac3a417, 0x3a965e27,
    0x3bcb6bab, 0x1ff1459d, 0xacab58fa, 0x4b9303e3,
    0x2055fa30, 0xadf66d76, 0x889176cc, 0xf5254c02,
    0x4ffcd7e5, 0xc5d7cb2a, 0x26804435, 0xb58fa362,
    0xde495ab1, 0x25671bba, 0x45980eea, 0x5de1c0fe,
    0xc302752f, 0x8112f04c, 0x8da39746, 0x6bc6f9d3,
    0x03e75f8f, 0x15959c92, 0xbfeb7a6d, 0x95da5952,
    0xd42d83be, 0x58d32174, 0x492969e0, 0x8e44c8c9,
    0x756a89c2, 0xf478798e, 0x996b3e58, 0x27dd71b9,
    0xbeb64fe1, 0xf017ad88, 0xc966ac20, 0x7db43ace,
    0x63184adf, 0xe582311a, 0x97603351, 0x62457f53,
    0xb1e07764, 0xbb84ae6b, 0xfe1ca081, 0xf9942b08,
    0x70586848, 0x8f19fd45, 0x94876cde, 0x52b7f87b,
    0xab23d373, 0x72e2024b, 0xe3578f1f, 0x662aab55,
    0xb20728eb, 0x2f03c2b5, 0x869a7bc5, 0xd3a50837,
    0x30f28728, 0x23b2a5bf, 0x02ba6a03, 0xed5c8216,
    0x8a2b1ccf, 0xa792b479, 0xf3f0f207, 0x4ea1e269,
    0x65cdf4da, 0x06d5be05, 0xd11f6234, 0xc48afea6,
    0x349d532e, 0xa2a055f3, 0x0532e18a, 0xa475ebf6,
    0x0b39ec83, 0x40aaef60, 0x5e069f71, 0xbd51106e,
    0x3ef98a21, 0x963d06dd, 0xddae053e, 0x4d46bde6,
    0x91b58d54, 0x71055dc4, 0x046fd406, 0x60ff1550,
    0x1924fb98, 0xd697e9bd, 0x89cc4340, 0x67779ed9,
    0xb0bd42e8, 0x07888b89, 0xe7385b19, 0x79dbeec8,
    0xa1470a7c, 0x7ce90f42, 0xf8c91e84, 0x00000000,
    0x09838680, 0x3248ed2b, 0x1eac7011, 0x6c4e725a,
    0xfdfbff0e, 0x0f563885, 0x3d1ed5ae, 0x3627392d,
    0x0a64d90f, 0x6821a65c, 0x9bd1545b, 0x243a2e36,
    0x0cb1670a, 0x930fe757, 0xb4d296ee, 0x1b9e919b,
    0x804fc5c0, 0x61a220dc, 0x5a694b77, 0x1c161a12,
    0xe20aba93, 0xc0e52aa0, 0x3c43e022, 0x121d171b,
    0x0e0b0d09, 0xf2adc78b, 0x2db9a8b6, 0x14c8a91e,
    0x578519f1, 0xaf4c0775, 0xeebbdd99, 0xa3fd607f,
    0xf79f2601, 0x5cbcf572, 0x44c53b66, 0x5b347efb,
    0x8b762943, 0xcbdcc623, 0xb668fced, 0xb863f1e4,
    0xd7cadc31, 0x42108563, 0x13402297, 0x842011c6,
    0x857d244a, 0xd2f83dbb, 0xae1132f9, 0xc76da129,
    0x1d4b2f9e, 0xdcf330b2, 0x0dec5286, 0x77d0e3c1,
    0x2b6c16b3, 0xa999b970, 0x11fa4894, 0x472264e9,
    0xa8c48cfc, 0xa01a3ff0, 0x56d82c7d, 0x22ef9033,
    0x87c74e49, 0xd9c1d138, 0x8cfea2ca, 0x98360bd4,
    0xa6cf81f5, 0xa528de7a, 0xda268eb7, 0x3fa4bfad,
    0x2ce49d3a, 0x500d9278, 0x6a9bcc5f, 0x5462467e,
    0xf6c2138d, 0x90e8b8d8, 0x2e5ef739, 0x82f5afc3,
    0x9fbe805d, 0x697c93d0, 0x6fa92dd5, 0xcfb31225,
    0xc83b99ac, 0x10a77d18, 0xe86e639c, 0xdb7bbb3b,
    0xcd097826, 0x6ef41859, 0xec01b79a, 0x83a89a4f,
    0xe6656e95, 0xaa7ee6ff, 0x2108cfbc, 0xefe6e815,
    0xbad99be7, 0x4ace366f, 0xead4099f, 0x29d67cb0,
    0x31afb2a4, 0x2a31233f, 0xc63094a5, 0x35c066a2,
    0x7437bc4e, 0xfca6ca82, 0xe0b0d090, 0x3315d8a7,
    0xf14a9804, 0x41f7daec, 0x7f0e50cd, 0x172ff691,
    0x768dd64d, 0x434db0ef, 0xcc544daa, 0xe4df0496,
    0x9ee3b5d1, 0x4c1b886a, 0xc1b81f2c, 0x467f5165,
    0x9d04ea5e, 0x015d358c, 0xfa737487, 0xfb2e410b,
    0xb35a1d67, 0x9252d2db, 0xe9335610, 0x6d1347d6,
    0x9a8c61d7, 0x377a0ca1, 0x598e14f8, 0xeb893c13,
    0xceee27a9, 0xb735c961, 0xe1ede51c, 0x7a3cb147,
    0x9c59dfd2, 0x553f73f2, 0x1879ce14, 0x73bf37c7,
    0x53eacdf7, 0x5f5baafd, 0xdf146f3d, 0x7886db44,
    0xca81f3af, 0xb93ec468, 0x382c3424, 0xc25f40a3,
    0x1672c31d, 0xbc0c25e2, 0x288b493c, 0xff41950d,
    0x397101a8, 0x08deb30c, 0xd89ce4b4, 0x6490c156,
    0x7b6184cb, 0xd570b632, 0x48745c6c, 0xd04257b8];

    var U1 = [
    0x00000000, 0x0b0d090e, 0x161a121c, 0x1d171b12,
    0x2c342438, 0x27392d36, 0x3a2e3624, 0x31233f2a,
    0x58684870, 0x5365417e, 0x4e725a6c, 0x457f5362,
    0x745c6c48, 0x7f516546, 0x62467e54, 0x694b775a,
    0xb0d090e0, 0xbbdd99ee, 0xa6ca82fc, 0xadc78bf2,
    0x9ce4b4d8, 0x97e9bdd6, 0x8afea6c4, 0x81f3afca,
    0xe8b8d890, 0xe3b5d19e, 0xfea2ca8c, 0xf5afc382,
    0xc48cfca8, 0xcf81f5a6, 0xd296eeb4, 0xd99be7ba,
    0x7bbb3bdb, 0x70b632d5, 0x6da129c7, 0x66ac20c9,
    0x578f1fe3, 0x5c8216ed, 0x41950dff, 0x4a9804f1,
    0x23d373ab, 0x28de7aa5, 0x35c961b7, 0x3ec468b9,
    0x0fe75793, 0x04ea5e9d, 0x19fd458f, 0x12f04c81,
    0xcb6bab3b, 0xc066a235, 0xdd71b927, 0xd67cb029,
    0xe75f8f03, 0xec52860d, 0xf1459d1f, 0xfa489411,
    0x9303e34b, 0x980eea45, 0x8519f157, 0x8e14f859,
    0xbf37c773, 0xb43ace7d, 0xa92dd56f, 0xa220dc61,
    0xf66d76ad, 0xfd607fa3, 0xe07764b1, 0xeb7a6dbf,
    0xda595295, 0xd1545b9b, 0xcc434089, 0xc74e4987,
    0xae053edd, 0xa50837d3, 0xb81f2cc1, 0xb31225cf,
    0x82311ae5, 0x893c13eb, 0x942b08f9, 0x9f2601f7,
    0x46bde64d, 0x4db0ef43, 0x50a7f451, 0x5baafd5f,
    0x6a89c275, 0x6184cb7b, 0x7c93d069, 0x779ed967,
    0x1ed5ae3d, 0x15d8a733, 0x08cfbc21, 0x03c2b52f,
    0x32e18a05, 0x39ec830b, 0x24fb9819, 0x2ff69117,
    0x8dd64d76, 0x86db4478, 0x9bcc5f6a, 0x90c15664,
    0xa1e2694e, 0xaaef6040, 0xb7f87b52, 0xbcf5725c,
    0xd5be0506, 0xdeb30c08, 0xc3a4171a, 0xc8a91e14,
    0xf98a213e, 0xf2872830, 0xef903322, 0xe49d3a2c,
    0x3d06dd96, 0x360bd498, 0x2b1ccf8a, 0x2011c684,
    0x1132f9ae, 0x1a3ff0a0, 0x0728ebb2, 0x0c25e2bc,
    0x656e95e6, 0x6e639ce8, 0x737487fa, 0x78798ef4,
    0x495ab1de, 0x4257b8d0, 0x5f40a3c2, 0x544daacc,
    0xf7daec41, 0xfcd7e54f, 0xe1c0fe5d, 0xeacdf753,
    0xdbeec879, 0xd0e3c177, 0xcdf4da65, 0xc6f9d36b,
    0xafb2a431, 0xa4bfad3f, 0xb9a8b62d, 0xb2a5bf23,
    0x83868009, 0x888b8907, 0x959c9215, 0x9e919b1b,
    0x470a7ca1, 0x4c0775af, 0x51106ebd, 0x5a1d67b3,
    0x6b3e5899, 0x60335197, 0x7d244a85, 0x7629438b,
    0x1f6234d1, 0x146f3ddf, 0x097826cd, 0x02752fc3,
    0x335610e9, 0x385b19e7, 0x254c02f5, 0x2e410bfb,
    0x8c61d79a, 0x876cde94, 0x9a7bc586, 0x9176cc88,
    0xa055f3a2, 0xab58faac, 0xb64fe1be, 0xbd42e8b0,
    0xd4099fea, 0xdf0496e4, 0xc2138df6, 0xc91e84f8,
    0xf83dbbd2, 0xf330b2dc, 0xee27a9ce, 0xe52aa0c0,
    0x3cb1477a, 0x37bc4e74, 0x2aab5566, 0x21a65c68,
    0x10856342, 0x1b886a4c, 0x069f715e, 0x0d927850,
    0x64d90f0a, 0x6fd40604, 0x72c31d16, 0x79ce1418,
    0x48ed2b32, 0x43e0223c, 0x5ef7392e, 0x55fa3020,
    0x01b79aec, 0x0aba93e2, 0x17ad88f0, 0x1ca081fe,
    0x2d83bed4, 0x268eb7da, 0x3b99acc8, 0x3094a5c6,
    0x59dfd29c, 0x52d2db92, 0x4fc5c080, 0x44c8c98e,
    0x75ebf6a4, 0x7ee6ffaa, 0x63f1e4b8, 0x68fcedb6,
    0xb1670a0c, 0xba6a0302, 0xa77d1810, 0xac70111e,
    0x9d532e34, 0x965e273a, 0x8b493c28, 0x80443526,
    0xe90f427c, 0xe2024b72, 0xff155060, 0xf418596e,
    0xc53b6644, 0xce366f4a, 0xd3217458, 0xd82c7d56,
    0x7a0ca137, 0x7101a839, 0x6c16b32b, 0x671bba25,
    0x5638850f, 0x5d358c01, 0x40229713, 0x4b2f9e1d,
    0x2264e947, 0x2969e049, 0x347efb5b, 0x3f73f255,
    0x0e50cd7f, 0x055dc471, 0x184adf63, 0x1347d66d,
    0xcadc31d7, 0xc1d138d9, 0xdcc623cb, 0xd7cb2ac5,
    0xe6e815ef, 0xede51ce1, 0xf0f207f3, 0xfbff0efd,
    0x92b479a7, 0x99b970a9, 0x84ae6bbb, 0x8fa362b5,
    0xbe805d9f, 0xb58d5491, 0xa89a4f83, 0xa397468d];

    var U2 = [
    0x00000000, 0x0d090e0b, 0x1a121c16, 0x171b121d,
    0x3424382c, 0x392d3627, 0x2e36243a, 0x233f2a31,
    0x68487058, 0x65417e53, 0x725a6c4e, 0x7f536245,
    0x5c6c4874, 0x5165467f, 0x467e5462, 0x4b775a69,
    0xd090e0b0, 0xdd99eebb, 0xca82fca6, 0xc78bf2ad,
    0xe4b4d89c, 0xe9bdd697, 0xfea6c48a, 0xf3afca81,
    0xb8d890e8, 0xb5d19ee3, 0xa2ca8cfe, 0xafc382f5,
    0x8cfca8c4, 0x81f5a6cf, 0x96eeb4d2, 0x9be7bad9,
    0xbb3bdb7b, 0xb632d570, 0xa129c76d, 0xac20c966,
    0x8f1fe357, 0x8216ed5c, 0x950dff41, 0x9804f14a,
    0xd373ab23, 0xde7aa528, 0xc961b735, 0xc468b93e,
    0xe757930f, 0xea5e9d04, 0xfd458f19, 0xf04c8112,
    0x6bab3bcb, 0x66a235c0, 0x71b927dd, 0x7cb029d6,
    0x5f8f03e7, 0x52860dec, 0x459d1ff1, 0x489411fa,
    0x03e34b93, 0x0eea4598, 0x19f15785, 0x14f8598e,
    0x37c773bf, 0x3ace7db4, 0x2dd56fa9, 0x20dc61a2,
    0x6d76adf6, 0x607fa3fd, 0x7764b1e0, 0x7a6dbfeb,
    0x595295da, 0x545b9bd1, 0x434089cc, 0x4e4987c7,
    0x053eddae, 0x0837d3a5, 0x1f2cc1b8, 0x1225cfb3,
    0x311ae582, 0x3c13eb89, 0x2b08f994, 0x2601f79f,
    0xbde64d46, 0xb0ef434d, 0xa7f45150, 0xaafd5f5b,
    0x89c2756a, 0x84cb7b61, 0x93d0697c, 0x9ed96777,
    0xd5ae3d1e, 0xd8a73315, 0xcfbc2108, 0xc2b52f03,
    0xe18a0532, 0xec830b39, 0xfb981924, 0xf691172f,
    0xd64d768d, 0xdb447886, 0xcc5f6a9b, 0xc1566490,
    0xe2694ea1, 0xef6040aa, 0xf87b52b7, 0xf5725cbc,
    0xbe0506d5, 0xb30c08de, 0xa4171ac3, 0xa91e14c8,
    0x8a213ef9, 0x872830f2, 0x903322ef, 0x9d3a2ce4,
    0x06dd963d, 0x0bd49836, 0x1ccf8a2b, 0x11c68420,
    0x32f9ae11, 0x3ff0a01a, 0x28ebb207, 0x25e2bc0c,
    0x6e95e665, 0x639ce86e, 0x7487fa73, 0x798ef478,
    0x5ab1de49, 0x57b8d042, 0x40a3c25f, 0x4daacc54,
    0xdaec41f7, 0xd7e54ffc, 0xc0fe5de1, 0xcdf753ea,
    0xeec879db, 0xe3c177d0, 0xf4da65cd, 0xf9d36bc6,
    0xb2a431af, 0xbfad3fa4, 0xa8b62db9, 0xa5bf23b2,
    0x86800983, 0x8b890788, 0x9c921595, 0x919b1b9e,
    0x0a7ca147, 0x0775af4c, 0x106ebd51, 0x1d67b35a,
    0x3e58996b, 0x33519760, 0x244a857d, 0x29438b76,
    0x6234d11f, 0x6f3ddf14, 0x7826cd09, 0x752fc302,
    0x5610e933, 0x5b19e738, 0x4c02f525, 0x410bfb2e,
    0x61d79a8c, 0x6cde9487, 0x7bc5869a, 0x76cc8891,
    0x55f3a2a0, 0x58faacab, 0x4fe1beb6, 0x42e8b0bd,
    0x099fead4, 0x0496e4df, 0x138df6c2, 0x1e84f8c9,
    0x3dbbd2f8, 0x30b2dcf3, 0x27a9ceee, 0x2aa0c0e5,
    0xb1477a3c, 0xbc4e7437, 0xab55662a, 0xa65c6821,
    0x85634210, 0x886a4c1b, 0x9f715e06, 0x9278500d,
    0xd90f0a64, 0xd406046f, 0xc31d1672, 0xce141879,
    0xed2b3248, 0xe0223c43, 0xf7392e5e, 0xfa302055,
    0xb79aec01, 0xba93e20a, 0xad88f017, 0xa081fe1c,
    0x83bed42d, 0x8eb7da26, 0x99acc83b, 0x94a5c630,
    0xdfd29c59, 0xd2db9252, 0xc5c0804f, 0xc8c98e44,
    0xebf6a475, 0xe6ffaa7e, 0xf1e4b863, 0xfcedb668,
    0x670a0cb1, 0x6a0302ba, 0x7d1810a7, 0x70111eac,
    0x532e349d, 0x5e273a96, 0x493c288b, 0x44352680,
    0x0f427ce9, 0x024b72e2, 0x155060ff, 0x18596ef4,
    0x3b6644c5, 0x366f4ace, 0x217458d3, 0x2c7d56d8,
    0x0ca1377a, 0x01a83971, 0x16b32b6c, 0x1bba2567,
    0x38850f56, 0x358c015d, 0x22971340, 0x2f9e1d4b,
    0x64e94722, 0x69e04929, 0x7efb5b34, 0x73f2553f,
    0x50cd7f0e, 0x5dc47105, 0x4adf6318, 0x47d66d13,
    0xdc31d7ca, 0xd138d9c1, 0xc623cbdc, 0xcb2ac5d7,
    0xe815efe6, 0xe51ce1ed, 0xf207f3f0, 0xff0efdfb,
    0xb479a792, 0xb970a999, 0xae6bbb84, 0xa362b58f,
    0x805d9fbe, 0x8d5491b5, 0x9a4f83a8, 0x97468da3,
    ];

    var U3 = [
    0x00000000, 0x090e0b0d, 0x121c161a, 0x1b121d17,
    0x24382c34, 0x2d362739, 0x36243a2e, 0x3f2a3123,
    0x48705868, 0x417e5365, 0x5a6c4e72, 0x5362457f,
    0x6c48745c, 0x65467f51, 0x7e546246, 0x775a694b,
    0x90e0b0d0, 0x99eebbdd, 0x82fca6ca, 0x8bf2adc7,
    0xb4d89ce4, 0xbdd697e9, 0xa6c48afe, 0xafca81f3,
    0xd890e8b8, 0xd19ee3b5, 0xca8cfea2, 0xc382f5af,
    0xfca8c48c, 0xf5a6cf81, 0xeeb4d296, 0xe7bad99b,
    0x3bdb7bbb, 0x32d570b6, 0x29c76da1, 0x20c966ac,
    0x1fe3578f, 0x16ed5c82, 0x0dff4195, 0x04f14a98,
    0x73ab23d3, 0x7aa528de, 0x61b735c9, 0x68b93ec4,
    0x57930fe7, 0x5e9d04ea, 0x458f19fd, 0x4c8112f0,
    0xab3bcb6b, 0xa235c066, 0xb927dd71, 0xb029d67c,
    0x8f03e75f, 0x860dec52, 0x9d1ff145, 0x9411fa48,
    0xe34b9303, 0xea45980e, 0xf1578519, 0xf8598e14,
    0xc773bf37, 0xce7db43a, 0xd56fa92d, 0xdc61a220,
    0x76adf66d, 0x7fa3fd60, 0x64b1e077, 0x6dbfeb7a,
    0x5295da59, 0x5b9bd154, 0x4089cc43, 0x4987c74e,
    0x3eddae05, 0x37d3a508, 0x2cc1b81f, 0x25cfb312,
    0x1ae58231, 0x13eb893c, 0x08f9942b, 0x01f79f26,
    0xe64d46bd, 0xef434db0, 0xf45150a7, 0xfd5f5baa,
    0xc2756a89, 0xcb7b6184, 0xd0697c93, 0xd967779e,
    0xae3d1ed5, 0xa73315d8, 0xbc2108cf, 0xb52f03c2,
    0x8a0532e1, 0x830b39ec, 0x981924fb, 0x91172ff6,
    0x4d768dd6, 0x447886db, 0x5f6a9bcc, 0x566490c1,
    0x694ea1e2, 0x6040aaef, 0x7b52b7f8, 0x725cbcf5,
    0x0506d5be, 0x0c08deb3, 0x171ac3a4, 0x1e14c8a9,
    0x213ef98a, 0x2830f287, 0x3322ef90, 0x3a2ce49d,
    0xdd963d06, 0xd498360b, 0xcf8a2b1c, 0xc6842011,
    0xf9ae1132, 0xf0a01a3f, 0xebb20728, 0xe2bc0c25,
    0x95e6656e, 0x9ce86e63, 0x87fa7374, 0x8ef47879,
    0xb1de495a, 0xb8d04257, 0xa3c25f40, 0xaacc544d,
    0xec41f7da, 0xe54ffcd7, 0xfe5de1c0, 0xf753eacd,
    0xc879dbee, 0xc177d0e3, 0xda65cdf4, 0xd36bc6f9,
    0xa431afb2, 0xad3fa4bf, 0xb62db9a8, 0xbf23b2a5,
    0x80098386, 0x8907888b, 0x9215959c, 0x9b1b9e91,
    0x7ca1470a, 0x75af4c07, 0x6ebd5110, 0x67b35a1d,
    0x58996b3e, 0x51976033, 0x4a857d24, 0x438b7629,
    0x34d11f62, 0x3ddf146f, 0x26cd0978, 0x2fc30275,
    0x10e93356, 0x19e7385b, 0x02f5254c, 0x0bfb2e41,
    0xd79a8c61, 0xde94876c, 0xc5869a7b, 0xcc889176,
    0xf3a2a055, 0xfaacab58, 0xe1beb64f, 0xe8b0bd42,
    0x9fead409, 0x96e4df04, 0x8df6c213, 0x84f8c91e,
    0xbbd2f83d, 0xb2dcf330, 0xa9ceee27, 0xa0c0e52a,
    0x477a3cb1, 0x4e7437bc, 0x55662aab, 0x5c6821a6,
    0x63421085, 0x6a4c1b88, 0x715e069f, 0x78500d92,
    0x0f0a64d9, 0x06046fd4, 0x1d1672c3, 0x141879ce,
    0x2b3248ed, 0x223c43e0, 0x392e5ef7, 0x302055fa,
    0x9aec01b7, 0x93e20aba, 0x88f017ad, 0x81fe1ca0,
    0xbed42d83, 0xb7da268e, 0xacc83b99, 0xa5c63094,
    0xd29c59df, 0xdb9252d2, 0xc0804fc5, 0xc98e44c8,
    0xf6a475eb, 0xffaa7ee6, 0xe4b863f1, 0xedb668fc,
    0x0a0cb167, 0x0302ba6a, 0x1810a77d, 0x111eac70,
    0x2e349d53, 0x273a965e, 0x3c288b49, 0x35268044,
    0x427ce90f, 0x4b72e202, 0x5060ff15, 0x596ef418,
    0x6644c53b, 0x6f4ace36, 0x7458d321, 0x7d56d82c,
    0xa1377a0c, 0xa8397101, 0xb32b6c16, 0xba25671b,
    0x850f5638, 0x8c015d35, 0x97134022, 0x9e1d4b2f,
    0xe9472264, 0xe0492969, 0xfb5b347e, 0xf2553f73,
    0xcd7f0e50, 0xc471055d, 0xdf63184a, 0xd66d1347,
    0x31d7cadc, 0x38d9c1d1, 0x23cbdcc6, 0x2ac5d7cb,
    0x15efe6e8, 0x1ce1ede5, 0x07f3f0f2, 0x0efdfbff,
    0x79a792b4, 0x70a999b9, 0x6bbb84ae, 0x62b58fa3,
    0x5d9fbe80, 0x5491b58d, 0x4f83a89a, 0x468da397];

    var U4 = [
    0x00000000, 0x0e0b0d09, 0x1c161a12, 0x121d171b,
    0x382c3424, 0x3627392d, 0x243a2e36, 0x2a31233f,
    0x70586848, 0x7e536541, 0x6c4e725a, 0x62457f53,
    0x48745c6c, 0x467f5165, 0x5462467e, 0x5a694b77,
    0xe0b0d090, 0xeebbdd99, 0xfca6ca82, 0xf2adc78b,
    0xd89ce4b4, 0xd697e9bd, 0xc48afea6, 0xca81f3af,
    0x90e8b8d8, 0x9ee3b5d1, 0x8cfea2ca, 0x82f5afc3,
    0xa8c48cfc, 0xa6cf81f5, 0xb4d296ee, 0xbad99be7,
    0xdb7bbb3b, 0xd570b632, 0xc76da129, 0xc966ac20,
    0xe3578f1f, 0xed5c8216, 0xff41950d, 0xf14a9804,
    0xab23d373, 0xa528de7a, 0xb735c961, 0xb93ec468,
    0x930fe757, 0x9d04ea5e, 0x8f19fd45, 0x8112f04c,
    0x3bcb6bab, 0x35c066a2, 0x27dd71b9, 0x29d67cb0,
    0x03e75f8f, 0x0dec5286, 0x1ff1459d, 0x11fa4894,
    0x4b9303e3, 0x45980eea, 0x578519f1, 0x598e14f8,
    0x73bf37c7, 0x7db43ace, 0x6fa92dd5, 0x61a220dc,
    0xadf66d76, 0xa3fd607f, 0xb1e07764, 0xbfeb7a6d,
    0x95da5952, 0x9bd1545b, 0x89cc4340, 0x87c74e49,
    0xddae053e, 0xd3a50837, 0xc1b81f2c, 0xcfb31225,
    0xe582311a, 0xeb893c13, 0xf9942b08, 0xf79f2601,
    0x4d46bde6, 0x434db0ef, 0x5150a7f4, 0x5f5baafd,
    0x756a89c2, 0x7b6184cb, 0x697c93d0, 0x67779ed9,
    0x3d1ed5ae, 0x3315d8a7, 0x2108cfbc, 0x2f03c2b5,
    0x0532e18a, 0x0b39ec83, 0x1924fb98, 0x172ff691,
    0x768dd64d, 0x7886db44, 0x6a9bcc5f, 0x6490c156,
    0x4ea1e269, 0x40aaef60, 0x52b7f87b, 0x5cbcf572,
    0x06d5be05, 0x08deb30c, 0x1ac3a417, 0x14c8a91e,
    0x3ef98a21, 0x30f28728, 0x22ef9033, 0x2ce49d3a,
    0x963d06dd, 0x98360bd4, 0x8a2b1ccf, 0x842011c6,
    0xae1132f9, 0xa01a3ff0, 0xb20728eb, 0xbc0c25e2,
    0xe6656e95, 0xe86e639c, 0xfa737487, 0xf478798e,
    0xde495ab1, 0xd04257b8, 0xc25f40a3, 0xcc544daa,
    0x41f7daec, 0x4ffcd7e5, 0x5de1c0fe, 0x53eacdf7,
    0x79dbeec8, 0x77d0e3c1, 0x65cdf4da, 0x6bc6f9d3,
    0x31afb2a4, 0x3fa4bfad, 0x2db9a8b6, 0x23b2a5bf,
    0x09838680, 0x07888b89, 0x15959c92, 0x1b9e919b,
    0xa1470a7c, 0xaf4c0775, 0xbd51106e, 0xb35a1d67,
    0x996b3e58, 0x97603351, 0x857d244a, 0x8b762943,
    0xd11f6234, 0xdf146f3d, 0xcd097826, 0xc302752f,
    0xe9335610, 0xe7385b19, 0xf5254c02, 0xfb2e410b,
    0x9a8c61d7, 0x94876cde, 0x869a7bc5, 0x889176cc,
    0xa2a055f3, 0xacab58fa, 0xbeb64fe1, 0xb0bd42e8,
    0xead4099f, 0xe4df0496, 0xf6c2138d, 0xf8c91e84,
    0xd2f83dbb, 0xdcf330b2, 0xceee27a9, 0xc0e52aa0,
    0x7a3cb147, 0x7437bc4e, 0x662aab55, 0x6821a65c,
    0x42108563, 0x4c1b886a, 0x5e069f71, 0x500d9278,
    0x0a64d90f, 0x046fd406, 0x1672c31d, 0x1879ce14,
    0x3248ed2b, 0x3c43e022, 0x2e5ef739, 0x2055fa30,
    0xec01b79a, 0xe20aba93, 0xf017ad88, 0xfe1ca081,
    0xd42d83be, 0xda268eb7, 0xc83b99ac, 0xc63094a5,
    0x9c59dfd2, 0x9252d2db, 0x804fc5c0, 0x8e44c8c9,
    0xa475ebf6, 0xaa7ee6ff, 0xb863f1e4, 0xb668fced,
    0x0cb1670a, 0x02ba6a03, 0x10a77d18, 0x1eac7011,
    0x349d532e, 0x3a965e27, 0x288b493c, 0x26804435,
    0x7ce90f42, 0x72e2024b, 0x60ff1550, 0x6ef41859,
    0x44c53b66, 0x4ace366f, 0x58d32174, 0x56d82c7d,
    0x377a0ca1, 0x397101a8, 0x2b6c16b3, 0x25671bba,
    0x0f563885, 0x015d358c, 0x13402297, 0x1d4b2f9e,
    0x472264e9, 0x492969e0, 0x5b347efb, 0x553f73f2,
    0x7f0e50cd, 0x71055dc4, 0x63184adf, 0x6d1347d6,
    0xd7cadc31, 0xd9c1d138, 0xcbdcc623, 0xc5d7cb2a,
    0xefe6e815, 0xe1ede51c, 0xf3f0f207, 0xfdfbff0e,
    0xa792b479, 0xa999b970, 0xbb84ae6b, 0xb58fa362,
    0x9fbe805d, 0x91b58d54, 0x83a89a4f, 0x8da39746];

    function prepare_decryption(key) {
        var r, w;
        var rk2 = new Array(maxrk + 1);

        var ctx = new keyExpansion(key);

        var rounds = ctx.rounds;

        for (r = 0; r < maxrk + 1; r++) {
            rk2[r] = new Array(4);

            rk2[r][0] = ctx.rk[r][0];
            rk2[r][1] = ctx.rk[r][1];
            rk2[r][2] = ctx.rk[r][2];
            rk2[r][3] = ctx.rk[r][3];
        }

        for (r = 1; r < rounds; r++) {
            w = rk2[r][0]; rk2[r][0] = U1[B0(w)] ^ U2[B1(w)] ^ U3[B2(w)] ^ U4[B3(w)];
            w = rk2[r][1]; rk2[r][1] = U1[B0(w)] ^ U2[B1(w)] ^ U3[B2(w)] ^ U4[B3(w)];
            w = rk2[r][2]; rk2[r][2] = U1[B0(w)] ^ U2[B1(w)] ^ U3[B2(w)] ^ U4[B3(w)];
            w = rk2[r][3]; rk2[r][3] = U1[B0(w)] ^ U2[B1(w)] ^ U3[B2(w)] ^ U4[B3(w)];
        }
        this.rk = rk2;
        this.rounds = rounds;
        return this;
    }

    function AESdecrypt(block, ctx) {
        var r;
        var t0, t1, t2, t3;
        var rounds = ctx.rounds;

        var b = packBytes(block);

        for (r = rounds; r > 1; r--) {
            t0 = b[0] ^ ctx.rk[r][0];
            t1 = b[1] ^ ctx.rk[r][1];
            t2 = b[2] ^ ctx.rk[r][2];
            t3 = b[3] ^ ctx.rk[r][3];

            b[0] = T5[B0(t0)] ^ T6[B1(t3)] ^ T7[B2(t2)] ^ T8[B3(t1)];
            b[1] = T5[B0(t1)] ^ T6[B1(t0)] ^ T7[B2(t3)] ^ T8[B3(t2)];
            b[2] = T5[B0(t2)] ^ T6[B1(t1)] ^ T7[B2(t0)] ^ T8[B3(t3)];
            b[3] = T5[B0(t3)] ^ T6[B1(t2)] ^ T7[B2(t1)] ^ T8[B3(t0)];
        }

        // last round is special
        t0 = b[0] ^ ctx.rk[1][0];
        t1 = b[1] ^ ctx.rk[1][1];
        t2 = b[2] ^ ctx.rk[1][2];
        t3 = b[3] ^ ctx.rk[1][3];

        b[0] = S5[B0(t0)] | (S5[B1(t3)] << 8) | (S5[B2(t2)] << 16) | (S5[B3(t1)] << 24);
        b[1] = S5[B0(t1)] | (S5[B1(t0)] << 8) | (S5[B2(t3)] << 16) | (S5[B3(t2)] << 24);
        b[2] = S5[B0(t2)] | (S5[B1(t1)] << 8) | (S5[B2(t0)] << 16) | (S5[B3(t3)] << 24);
        b[3] = S5[B0(t3)] | (S5[B1(t2)] << 8) | (S5[B2(t1)] << 16) | (S5[B3(t0)] << 24);

        b[0] ^= ctx.rk[0][0];
        b[1] ^= ctx.rk[0][1];
        b[2] ^= ctx.rk[0][2];
        b[3] ^= ctx.rk[0][3];

        return unpackBytes(b);
    }


    (function() {/*
 A JavaScript implementation of the SHA family of hashes, as defined in FIPS
 PUB 180-2 as well as the corresponding HMAC implementation as defined in
 FIPS PUB 198a

 Copyright Brian Turek 2008-2012
 Distributed under the BSD License
 See http://caligatio.github.com/jsSHA/ for more information

 Several functions taken from Paul Johnson
*/
function n(a){throw a;}var q=null;function s(a,b){this.a=a;this.b=b}function u(a,b){var d=[],h=(1<<b)-1,f=a.length*b,g;for(g=0;g<f;g+=b)d[g>>>5]|=(a.charCodeAt(g/b)&h)<<32-b-g%32;return{value:d,binLen:f}}function x(a){var b=[],d=a.length,h,f;0!==d%2&&n("String of HEX type must be in byte increments");for(h=0;h<d;h+=2)f=parseInt(a.substr(h,2),16),isNaN(f)&&n("String of HEX type contains invalid characters"),b[h>>>3]|=f<<24-4*(h%8);return{value:b,binLen:4*d}}
function B(a){var b=[],d=0,h,f,g,k,m;-1===a.search(/^[a-zA-Z0-9=+\/]+$/)&&n("Invalid character in base-64 string");h=a.indexOf("=");a=a.replace(/\=/g,"");-1!==h&&h<a.length&&n("Invalid '=' found in base-64 string");for(f=0;f<a.length;f+=4){m=a.substr(f,4);for(g=k=0;g<m.length;g+=1)h="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(m[g]),k|=h<<18-6*g;for(g=0;g<m.length-1;g+=1)b[d>>2]|=(k>>>16-8*g&255)<<24-8*(d%4),d+=1}return{value:b,binLen:8*d}}
function E(a,b){var d="",h=4*a.length,f,g;for(f=0;f<h;f+=1)g=a[f>>>2]>>>8*(3-f%4),d+="0123456789abcdef".charAt(g>>>4&15)+"0123456789abcdef".charAt(g&15);return b.outputUpper?d.toUpperCase():d}
function F(a,b){var d="",h=4*a.length,f,g,k;for(f=0;f<h;f+=3){k=(a[f>>>2]>>>8*(3-f%4)&255)<<16|(a[f+1>>>2]>>>8*(3-(f+1)%4)&255)<<8|a[f+2>>>2]>>>8*(3-(f+2)%4)&255;for(g=0;4>g;g+=1)d=8*f+6*g<=32*a.length?d+"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(k>>>6*(3-g)&63):d+b.b64Pad}return d}
function G(a){var b={outputUpper:!1,b64Pad:"="};try{a.hasOwnProperty("outputUpper")&&(b.outputUpper=a.outputUpper),a.hasOwnProperty("b64Pad")&&(b.b64Pad=a.b64Pad)}catch(d){}"boolean"!==typeof b.outputUpper&&n("Invalid outputUpper formatting option");"string"!==typeof b.b64Pad&&n("Invalid b64Pad formatting option");return b}
function H(a,b){var d=q,d=new s(a.a,a.b);return d=32>=b?new s(d.a>>>b|d.b<<32-b&4294967295,d.b>>>b|d.a<<32-b&4294967295):new s(d.b>>>b-32|d.a<<64-b&4294967295,d.a>>>b-32|d.b<<64-b&4294967295)}function I(a,b){var d=q;return d=32>=b?new s(a.a>>>b,a.b>>>b|a.a<<32-b&4294967295):new s(0,a.a>>>b-32)}function J(a,b,d){return new s(a.a&b.a^~a.a&d.a,a.b&b.b^~a.b&d.b)}function U(a,b,d){return new s(a.a&b.a^a.a&d.a^b.a&d.a,a.b&b.b^a.b&d.b^b.b&d.b)}
function V(a){var b=H(a,28),d=H(a,34);a=H(a,39);return new s(b.a^d.a^a.a,b.b^d.b^a.b)}function W(a){var b=H(a,14),d=H(a,18);a=H(a,41);return new s(b.a^d.a^a.a,b.b^d.b^a.b)}function X(a){var b=H(a,1),d=H(a,8);a=I(a,7);return new s(b.a^d.a^a.a,b.b^d.b^a.b)}function Y(a){var b=H(a,19),d=H(a,61);a=I(a,6);return new s(b.a^d.a^a.a,b.b^d.b^a.b)}
function Z(a,b){var d,h,f;d=(a.b&65535)+(b.b&65535);h=(a.b>>>16)+(b.b>>>16)+(d>>>16);f=(h&65535)<<16|d&65535;d=(a.a&65535)+(b.a&65535)+(h>>>16);h=(a.a>>>16)+(b.a>>>16)+(d>>>16);return new s((h&65535)<<16|d&65535,f)}
function aa(a,b,d,h){var f,g,k;f=(a.b&65535)+(b.b&65535)+(d.b&65535)+(h.b&65535);g=(a.b>>>16)+(b.b>>>16)+(d.b>>>16)+(h.b>>>16)+(f>>>16);k=(g&65535)<<16|f&65535;f=(a.a&65535)+(b.a&65535)+(d.a&65535)+(h.a&65535)+(g>>>16);g=(a.a>>>16)+(b.a>>>16)+(d.a>>>16)+(h.a>>>16)+(f>>>16);return new s((g&65535)<<16|f&65535,k)}
function ba(a,b,d,h,f){var g,k,m;g=(a.b&65535)+(b.b&65535)+(d.b&65535)+(h.b&65535)+(f.b&65535);k=(a.b>>>16)+(b.b>>>16)+(d.b>>>16)+(h.b>>>16)+(f.b>>>16)+(g>>>16);m=(k&65535)<<16|g&65535;g=(a.a&65535)+(b.a&65535)+(d.a&65535)+(h.a&65535)+(f.a&65535)+(k>>>16);k=(a.a>>>16)+(b.a>>>16)+(d.a>>>16)+(h.a>>>16)+(f.a>>>16)+(g>>>16);return new s((k&65535)<<16|g&65535,m)}
function $(a,b,d){var h,f,g,k,m,j,A,C,K,e,L,v,l,M,t,p,y,z,r,N,O,P,Q,R,c,S,w=[],T,D;"SHA-384"===d||"SHA-512"===d?(L=80,h=(b+128>>>10<<5)+31,M=32,t=2,c=s,p=Z,y=aa,z=ba,r=X,N=Y,O=V,P=W,R=U,Q=J,S=[new c(1116352408,3609767458),new c(1899447441,602891725),new c(3049323471,3964484399),new c(3921009573,2173295548),new c(961987163,4081628472),new c(1508970993,3053834265),new c(2453635748,2937671579),new c(2870763221,3664609560),new c(3624381080,2734883394),new c(310598401,1164996542),new c(607225278,1323610764),
new c(1426881987,3590304994),new c(1925078388,4068182383),new c(2162078206,991336113),new c(2614888103,633803317),new c(3248222580,3479774868),new c(3835390401,2666613458),new c(4022224774,944711139),new c(264347078,2341262773),new c(604807628,2007800933),new c(770255983,1495990901),new c(1249150122,1856431235),new c(1555081692,3175218132),new c(1996064986,2198950837),new c(2554220882,3999719339),new c(2821834349,766784016),new c(2952996808,2566594879),new c(3210313671,3203337956),new c(3336571891,
1034457026),new c(3584528711,2466948901),new c(113926993,3758326383),new c(338241895,168717936),new c(666307205,1188179964),new c(773529912,1546045734),new c(1294757372,1522805485),new c(1396182291,2643833823),new c(1695183700,2343527390),new c(1986661051,1014477480),new c(2177026350,1206759142),new c(2456956037,344077627),new c(2730485921,1290863460),new c(2820302411,3158454273),new c(3259730800,3505952657),new c(3345764771,106217008),new c(3516065817,3606008344),new c(3600352804,1432725776),new c(4094571909,
1467031594),new c(275423344,851169720),new c(430227734,3100823752),new c(506948616,1363258195),new c(659060556,3750685593),new c(883997877,3785050280),new c(958139571,3318307427),new c(1322822218,3812723403),new c(1537002063,2003034995),new c(1747873779,3602036899),new c(1955562222,1575990012),new c(2024104815,1125592928),new c(2227730452,2716904306),new c(2361852424,442776044),new c(2428436474,593698344),new c(2756734187,3733110249),new c(3204031479,2999351573),new c(3329325298,3815920427),new c(3391569614,
3928383900),new c(3515267271,566280711),new c(3940187606,3454069534),new c(4118630271,4000239992),new c(116418474,1914138554),new c(174292421,2731055270),new c(289380356,3203993006),new c(460393269,320620315),new c(685471733,587496836),new c(852142971,1086792851),new c(1017036298,365543100),new c(1126000580,2618297676),new c(1288033470,3409855158),new c(1501505948,4234509866),new c(1607167915,987167468),new c(1816402316,1246189591)],e="SHA-384"===d?[new c(3418070365,3238371032),new c(1654270250,914150663),
new c(2438529370,812702999),new c(355462360,4144912697),new c(1731405415,4290775857),new c(41048885895,1750603025),new c(3675008525,1694076839),new c(1203062813,3204075428)]:[new c(1779033703,4089235720),new c(3144134277,2227873595),new c(1013904242,4271175723),new c(2773480762,1595750129),new c(1359893119,2917565137),new c(2600822924,725511199),new c(528734635,4215389547),new c(1541459225,327033209)]):n("Unexpected error in SHA-2 implementation");a[b>>>5]|=128<<24-b%32;a[h]=b;T=a.length;for(v=0;v<
T;v+=M){b=e[0];h=e[1];f=e[2];g=e[3];k=e[4];m=e[5];j=e[6];A=e[7];for(l=0;l<L;l+=1)w[l]=16>l?new c(a[l*t+v],a[l*t+v+1]):y(N(w[l-2]),w[l-7],r(w[l-15]),w[l-16]),C=z(A,P(k),Q(k,m,j),S[l],w[l]),K=p(O(b),R(b,h,f)),A=j,j=m,m=k,k=p(g,C),g=f,f=h,h=b,b=p(C,K);e[0]=p(b,e[0]);e[1]=p(h,e[1]);e[2]=p(f,e[2]);e[3]=p(g,e[3]);e[4]=p(k,e[4]);e[5]=p(m,e[5]);e[6]=p(j,e[6]);e[7]=p(A,e[7])}"SHA-384"===d?D=[e[0].a,e[0].b,e[1].a,e[1].b,e[2].a,e[2].b,e[3].a,e[3].b,e[4].a,e[4].b,e[5].a,e[5].b]:"SHA-512"===d?D=[e[0].a,e[0].b,
e[1].a,e[1].b,e[2].a,e[2].b,e[3].a,e[3].b,e[4].a,e[4].b,e[5].a,e[5].b,e[6].a,e[6].b,e[7].a,e[7].b]:n("Unexpected error in SHA-2 implementation");return D}
window.jsSHA=function(a,b,d){var h=q,f=q,g=0,k=[0],m=0,j=q,m="undefined"!==typeof d?d:8;8===m||16===m||n("charSize must be 8 or 16");"HEX"===b?(0!==a.length%2&&n("srcString of HEX type must be in byte increments"),j=x(a),g=j.binLen,k=j.value):"ASCII"===b||"TEXT"===b?(j=u(a,m),g=j.binLen,k=j.value):"B64"===b?(j=B(a),g=j.binLen,k=j.value):n("inputFormat must be HEX, TEXT, ASCII, or B64");this.getHash=function(a,b,d){var e=q,m=k.slice(),j="";switch(b){case "HEX":e=E;break;case "B64":e=F;break;default:n("format must be HEX or B64")}"SHA-384"===
a?(q===h&&(h=$(m,g,a)),j=e(h,G(d))):"SHA-512"===a?(q===f&&(f=$(m,g,a)),j=e(f,G(d))):n("Chosen SHA variant is not supported");return j};this.getHMAC=function(a,b,d,e,f){var h,l,j,t,p,y=[],z=[],r=q;switch(e){case "HEX":h=E;break;case "B64":h=F;break;default:n("outputFormat must be HEX or B64")}"SHA-384"===d?(j=128,p=384):"SHA-512"===d?(j=128,p=512):n("Chosen SHA variant is not supported");"HEX"===b?(r=x(a),t=r.binLen,l=r.value):"ASCII"===b||"TEXT"===b?(r=u(a,m),t=r.binLen,l=r.value):"B64"===b?(r=B(a),
t=r.binLen,l=r.value):n("inputFormat must be HEX, TEXT, ASCII, or B64");a=8*j;b=j/4-1;j<t/8?(l=$(l,t,d),l[b]&=4294967040):j>t/8&&(l[b]&=4294967040);for(j=0;j<=b;j+=1)y[j]=l[j]^909522486,z[j]=l[j]^1549556828;d=$(z.concat($(y.concat(k),a+g,d)),a+p,d);return h(d,G(f))}};})();



    return {
        B0: B0,
        B1: B1,
        B2: B2,
        B3: B3
    };
});
