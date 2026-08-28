"use client";
import { useState } from "react";
import styles from "./line-portal.module.css";

type Customer = { id:string; name:string };
type Group = { uuid:string; name:string; lines:Array<{uuid:string;name:string}> };
type Props = { user:{ displayName:string; customerCompanyId:string; loginId:string }; customers:Customer[]; groups:Group[]; dataError:string|null };

export function LinePortal({ user, customers, groups, dataError }:Props) {
  const [tab,setTab] = useState<"home"|"data"|"account">("home");
  return <div className={styles.page}>
    <header className={styles.head}><div className={styles.brand}><span>SAM BRIDGE</span><span className={styles.oa}>LINE OA</span></div><h1 className={styles.hello}>สวัสดี, {user.displayName}</h1><p className={styles.company}>บริษัท {user.customerCompanyId}</p></header>
    <main className={styles.main}>
      {tab === "home" ? <><div className={styles.notice}>เข้าสู่ระบบ iXacs สำเร็จ ข้อมูลมาจากเครื่อง/ลูกค้าที่ Admin เพิ่มไว้ใน Settings</div><div className={styles.grid}><section className={styles.card}><p className={styles.eyebrow}>กลุ่มการผลิต</p><p className={styles.value}>{groups.length}</p></section><section className={styles.card}><p className={styles.eyebrow}>ไลน์ทั้งหมด</p><p className={styles.value}>{groups.reduce((sum,item)=>sum+item.lines.length,0)}</p></section></div><section className={styles.card}><p className={styles.eyebrow}>แหล่งข้อมูล</p><p className={styles.value}>{user.displayName}</p></section></> : null}
      {tab === "data" ? <><section className={styles.card}><p className={styles.eyebrow}>Production groups และ lines</p><p className={styles.value}>ข้อมูล iXacs</p><div className={styles.list}>{groups.length ? groups.map((group)=><div className={styles.item} key={group.uuid}><strong>{group.name}</strong><span>{group.lines.length ? group.lines.map((line)=>line.name).join(" · ") : "ยังไม่มีไลน์"}</span></div>) : <p className={styles.empty}>{dataError ? "ไม่สามารถโหลดข้อมูล iXacs ได้ในขณะนี้" : "ยังไม่มีข้อมูลไลน์"}</p>}</div></section><section className={styles.card}><p className={styles.eyebrow}>บริษัทลูกค้า</p><div className={styles.list}>{customers.map((item)=><div className={styles.item} key={item.id}><strong>{item.name}</strong><span>{item.id}</span></div>)}</div></section></> : null}
      {tab === "account" ? <><section className={styles.card}><p className={styles.eyebrow}>บัญชีของฉัน</p><p className={styles.value}>{user.displayName}</p><div className={styles.list}><div className={styles.item}><strong>ID บริษัทลูกค้า</strong><span className={styles.id}>{user.customerCompanyId}</span></div><div className={styles.item}><strong>Login ID</strong><span className={styles.id}>{user.loginId}</span></div></div></section><div className={styles.notice}>บัญชีนี้ใช้ได้เฉพาะ LINE OA และไม่ใช้ session ร่วมกับ Web Application</div></> : null}
    </main>
    <nav className={styles.nav} aria-label="เมนู LINE OA"><button className={`${styles.navItem} ${tab === "home" ? styles.active:""}`} onClick={()=>setTab("home")}><span className={styles.icon}>⌂</span>หน้าหลัก</button><button className={`${styles.navItem} ${tab === "data" ? styles.active:""}`} onClick={()=>setTab("data")}><span className={styles.icon}>▦</span>ข้อมูล</button><button className={`${styles.navItem} ${tab === "account" ? styles.active:""}`} onClick={()=>setTab("account")}><span className={styles.icon}>◉</span>บัญชี</button></nav>
  </div>;
}
