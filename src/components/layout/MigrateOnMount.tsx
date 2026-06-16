'use client'
import { useEffect } from 'react'
import { migrateLocalStorage } from '@/stores'

/**
 * 在 Client 端掛載時執行一次 LocalStorage 遷移
 * 確保舊版資料（twstock-trades 等）自動搬移到新 key
 */
export default function MigrateOnMount() {
  useEffect(() => {
    migrateLocalStorage()
  }, [])
  return null
}
