export const IMAGE_LIMIT=2*1024*1024;
export type ImageAsset={id:string;name:string;metadata:{width:number;height:number;mime:string;bytes:number};created_at?:string};
export function inspectImage(a:Uint8Array,limits={bytes:IMAGE_LIMIT,dimension:2048,pixels:4194304}) {
    const fail=():never=>{throw new Error('올바른 정적 PNG·JPG 이미지를 선택하세요.');};
    if(a.length>limits.bytes)throw new Error(`이미지는 ${Math.round(limits.bytes/1048576)}MB 이하로 선택하세요.`);
    const v=new DataView(a.buffer,a.byteOffset,a.byteLength);
    let width=0,height=0,mime='';
    const size=()=>{if(!width||!height||width>limits.dimension||height>limits.dimension||width*height>limits.pixels)throw new Error('이미지 해상도가 너무 크거나 올바르지 않습니다. 크기를 줄여 주세요.');};
    if(a.length>=33&&[137,80,78,71,13,10,26,10].every((n,i)=>a[i]===n)){
        mime='image/png';let at=8,header=false,data=false,end=false,palette=false,indexed=false,dataEnded=false,dataBytes=0;
        while(at+12<=a.length){const length=v.getUint32(at),tag=String.fromCharCode(...a.subarray(at+4,at+8)),start=at+8,stop=start+length;if(stop+4>a.length)fail();
            let crc=0xffffffff;for(let i=at+4;i<stop;i++){crc^=a[i];for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}if(((crc^0xffffffff)>>>0)!==v.getUint32(stop))fail();
            if(!header&&tag!=='IHDR')fail();
            if(data&&tag!=='IDAT')dataEnded=true;
            if(tag==='IHDR'){if(header||length!==13)fail();header=true;width=v.getUint32(start);height=v.getUint32(start+4);size();const bit=a[start+8],type=a[start+9];if(!({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]} as Record<number,number[]>)[type]?.includes(bit)||a[start+10]!==0||a[start+11]!==0||a[start+12]>1)fail();indexed=type===3;}
            else if(tag==='PLTE'){if(data||palette||!length||length%3||length>768)fail();palette=true;}
            else if(tag==='IDAT'){if(dataEnded||indexed&&!palette)fail();data=true;dataBytes+=length;}
            else if(tag==='IEND'){if(length||!dataBytes||stop+4!==a.length)fail();end=true;break;}
            else if(['acTL','fcTL','fdAT'].includes(tag)||!(a[at+4]&32))fail();
            at=stop+4;
        }
        if(!end)fail();
    }else if(a.length>=4&&a[0]===255&&a[1]===216){
        mime='image/jpeg';let at=2,frame=false,scan=false,end=false;
        while(at<a.length){if(a[at++]!==255)fail();while(a[at]===255)at++;const marker=a[at++];if(marker===217){if(!scan||at!==a.length)fail();end=true;break;}if(marker===216||marker===0||marker>=208&&marker<=215||at+2>a.length)fail();const length=v.getUint16(at),stop=at+length;if(length<2||stop>a.length)fail();
            if([192,193,194].includes(marker)){if(frame||length<11||a[at+2]!==8)fail();frame=true;height=v.getUint16(at+3);width=v.getUint16(at+5);size();const components=a[at+7];if(![1,3].includes(components)||length!==8+components*3)fail();}
            else if(marker>=192&&marker<=207&&![196,200,204].includes(marker))fail();
            if(marker===218){if(!frame||length<6)fail();const components=a[at+2];if(components<1||components>3||length!==6+2*components)fail();scan=true;at=stop;let entropy=0;while(at<a.length){if(a[at]!==255){at++;entropy++;continue;}if(a[at+1]===0||a[at+1]>=208&&a[at+1]<=215){at+=2;entropy++;continue;}break;}if(!entropy)fail();}else at=stop;
        }
        if(!end||!frame)fail();
    }else fail();
    return {width,height,mime,bytes:a.length};
}

export async function prepareImage(file:File) {
    if(file.size>8*1024*1024)throw new Error('원본 이미지는 8MB 이하로 선택하세요.');
    inspectImage(new Uint8Array(await file.arrayBuffer()),{bytes:8*1024*1024,dimension:8192,pixels:16000000});
    const url=URL.createObjectURL(file),image=new Image();
    try{image.src=url;await image.decode();const mime=file.type==='image/jpeg'?'image/jpeg':'image/png';
        for(const bound of [2048,1536,1024,768]){const scale=Math.min(1,bound/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('이미지를 처리할 수 없습니다.');ctx.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,mime,.9));if(blob&&blob.size<=IMAGE_LIMIT)return blob;}
        throw new Error('이미지 용량을 줄인 뒤 다시 시도하세요.');
    }finally{URL.revokeObjectURL(url);}
}
