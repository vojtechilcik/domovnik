import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Tenant data (from seed script)
const tenantData = {
  name: 'Petra Nováková',
  unit: 'Byt 2+kk, Praha',
  address: 'Sokolovská 45, Praha 8',
  rent: 20000,
  services: 1700,
  total: 21700,
  vs: '1201',
  leaseEnd: null,
  deposit: 40000,
};

const lastPayments = [
  { period: '2026-07', amount: 21700, status: 'Zaplaceno', date: '5. 7. 2026' },
  { period: '2026-06', amount: 21700, status: 'Zaplaceno', date: '5. 6. 2026' },
  { period: '2026-05', amount: 21700, status: 'Zaplaceno', date: '5. 5. 2026' },
];

const requests = [
  { id: 'rr1', desc: 'Praskla přívodní hadička k pračce', category: 'Voda a odpad', status: 'V řešení', urgency: 'havárie' },
];

type Tab = 'domu' | 'platby' | 'zavady';

export default function TenantApp() {
  const [activeTab, setActiveTab] = useState<Tab>('domu');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'domu', label: 'Domů' },
    { key: 'platby', label: 'Platby' },
    { key: 'zavady', label: 'Závady' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Main content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
        {activeTab === 'domu' && (
          <View>
            <Text style={styles.greeting}>Dobrý den, {tenantData.name.split(' ')[0]}</Text>

            {/* Unit card */}
            <View style={styles.card}>
              <Text style={styles.unitName}>{tenantData.unit}</Text>
              <Text style={styles.unitAddress}>{tenantData.address}</Text>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.fact}>
                  <Text style={styles.factLabel}>Nájemné + služby</Text>
                  <Text style={styles.factValue}>{(tenantData.total).toLocaleString('cs-CZ')} Kč/měs</Text>
                </View>
                <View style={styles.fact}>
                  <Text style={styles.factLabel}>Variabilní symbol</Text>
                  <Text style={styles.factValueMono}>{tenantData.vs}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.fact}>
                  <Text style={styles.factLabel}>Kauce</Text>
                  <Text style={styles.factValue}>{tenantData.deposit.toLocaleString('cs-CZ')} Kč</Text>
                </View>
                <View style={styles.fact}>
                  <Text style={styles.factLabel}>Smlouva do</Text>
                  <Text style={styles.factValue}>{tenantData.leaseEnd || 'doba neurčitá'}</Text>
                </View>
              </View>
            </View>

            {/* Report fault button */}
            <TouchableOpacity style={styles.reportButton} onPress={() => setActiveTab('zavady')}>
              <Text style={styles.reportButtonText}>Nahlásit závadu</Text>
            </TouchableOpacity>

            {/* Latest requests */}
            <Text style={styles.sectionTitle}>Poslední požadavky</Text>
            {requests.map((r) => (
              <View key={r.id} style={styles.requestCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestDesc}>{r.desc}</Text>
                  <Text style={styles.requestMeta}>{r.category} · {r.urgency}</Text>
                </View>
                <View style={[styles.statusPill, r.status === 'V řešení' ? styles.pillActive : styles.pillMuted]}>
                  <Text style={[styles.statusPillText, r.status === 'V řešení' ? styles.pillActiveText : styles.pillMutedText]}>{r.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'platby' && (
          <View>
            <Text style={styles.sectionTitle}>Platby — posledních 6 měsíců</Text>
            {lastPayments.map((p, i) => (
              <View key={i} style={styles.paymentRow}>
                <Text style={styles.mono}>{p.period}</Text>
                <Text style={styles.mono}>{(p.amount).toLocaleString('cs-CZ')} Kč</Text>
                <Text style={[styles.paymentStatus, p.status === 'Zaplaceno' ? styles.paid : styles.unpaid]}>{p.status}</Text>
              </View>
            ))}
            <Text style={styles.note}>Platbu proveďte s variabilním symbolem <Text style={styles.monoBold}>{tenantData.vs}</Text></Text>
          </View>
        )}

        {activeTab === 'zavady' && (
          <View>
            <TouchableOpacity style={styles.reportButton}>
              <Text style={styles.reportButtonText}>+ Nahlásit závadu</Text>
            </TouchableOpacity>
            {requests.map((r) => (
              <TouchableOpacity key={r.id} style={styles.requestCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestDesc}>{r.desc}</Text>
                  <Text style={styles.requestMeta}>{r.category} · {r.urgency}</Text>
                </View>
                <View style={[styles.statusPill, r.status === 'V řešení' ? styles.pillActive : styles.pillMuted]}>
                  <Text style={[styles.statusPillText, r.status === 'V řešení' ? styles.pillActiveText : styles.pillMutedText]}>{r.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eceae3' },
  content: { flex: 1, padding: 20 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1b1a17', marginBottom: 20 },
  card: { backgroundColor: '#faf9f5', borderRadius: 14, borderWidth: 1, borderColor: '#dbd8cf', padding: 20, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#2f4a3e' },
  unitName: { fontSize: 18, fontWeight: '700', color: '#1b1a17' },
  unitAddress: { fontSize: 14, color: '#6f6e66', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#dbd8cf', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  fact: { flex: 1 },
  factLabel: { fontSize: 11, color: '#6f6e66', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  factValue: { fontSize: 15, fontWeight: '600', color: '#1b1a17', marginTop: 2 },
  factValueMono: { fontSize: 18, fontWeight: '700', color: '#1b1a17', marginTop: 2 },
  reportButton: { backgroundColor: '#2f4a3e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  reportButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1b1a17', marginBottom: 12 },
  requestCard: { backgroundColor: '#faf9f5', borderRadius: 12, borderWidth: 1, borderColor: '#dbd8cf', padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  requestDesc: { fontSize: 14, fontWeight: '600', color: '#1b1a17' },
  requestMeta: { fontSize: 12, color: '#6f6e66', marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillActive: { backgroundColor: '#e2eae3' },
  pillMuted: { backgroundColor: '#f3f1ea' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  pillActiveText: { color: '#2f4a3e' },
  pillMutedText: { color: '#6f6e66' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#faf9f5', borderRadius: 10, borderWidth: 1, borderColor: '#dbd8cf', marginBottom: 6 },
  mono: { fontSize: 14, fontWeight: '500', color: '#1b1a17' },
  monoBold: { fontWeight: '700', fontSize: 15 },
  paymentStatus: { fontSize: 12, fontWeight: '700' },
  paid: { color: '#2f4a3e' },
  unpaid: { color: '#8a6420' },
  note: { marginTop: 20, fontSize: 13, color: '#6f6e66', textAlign: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: '#faf9f5', borderTopWidth: 1, borderTopColor: '#dbd8cf', paddingBottom: 20, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabActive: { borderTopWidth: 2, borderTopColor: '#2f4a3e' },
  tabLabel: { fontSize: 14, color: '#6f6e66', fontWeight: '500' },
  tabLabelActive: { color: '#2f4a3e', fontWeight: '700' },
});