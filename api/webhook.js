// api/webhook.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Configuração para o servidor (backend)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

export default async function handler(request, response) {
    if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');

    const { type, data } = request.body;
    const id = request.query.id || data?.id;

    if (id && (type === 'payment' || request.query.topic === 'payment')) {
        try {
            const payment = new Payment(client);
            const info = await payment.get({ id: id });

            if (info.status === 'approved') {
                const transactionId = info.external_reference;
                const userId = info.metadata?.user_id;

                if (transactionId && userId) {
                    const ref = doc(db, 'artifacts', 'default-app-id', 'users', userId, 'transactions', transactionId);
                    const docSnap = await getDoc(ref);
                    
                    if (docSnap.exists()) {
                        await updateDoc(ref, {
                            status: 'paid',
                            paymentDate: new Date().toISOString(),
                            gatewayId: String(info.id),
                            paidAmount: info.transaction_amount
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Erro Webhook:', error);
        }
    }
    return response.status(200).json({ received: true });
}

