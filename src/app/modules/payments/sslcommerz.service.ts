import axios from 'axios';
import httpStatus from 'http-status';

import ApiError from '../../errors/ApiError';
import config from '../../../configs';

interface ISSLCommerzSessionPayload {
  transactionId: string;
  amount: number;
  courseTitle: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
}

interface ISSLCommerzValidationResponse {
  status: string;
  tran_date: string;
  tran_id: string;
  val_id: string;
  amount: string;
  store_amount: string;
  currency: string;
  bank_tran_id: string;
  card_type: string;
  card_no: string;
  card_issuer: string;
  card_brand: string;
  card_issuer_country: string;
  currency_type: string;
  currency_amount: string;
  risk_level: string;
  risk_title: string;
}

const getBaseUrl = () => {
  return config.sslcommerz.is_sandbox
    ? 'https://sandbox.sslcommerz.com'
    : 'https://securepay.sslcommerz.com';
};

const initiateSession = async (payload: ISSLCommerzSessionPayload): Promise<string> => {
  const baseUrl = getBaseUrl();
  const initUrl = `${baseUrl}/gwprocess/v4/api.php`;

  const params = new URLSearchParams({
    store_id: config.sslcommerz.store_id,
    store_passwd: config.sslcommerz.store_password,
    total_amount: payload.amount.toString(),
    currency: 'BDT',
    tran_id: payload.transactionId,
    success_url: `${config.urls.backend_url}/api/v1/payments/sslcommerz/success?tran_id=${payload.transactionId}`,
    fail_url: `${config.urls.backend_url}/api/v1/payments/sslcommerz/fail?tran_id=${payload.transactionId}`,
    cancel_url: `${config.urls.backend_url}/api/v1/payments/sslcommerz/cancel?tran_id=${payload.transactionId}`,
    ipn_url: `${config.urls.backend_url}/api/v1/payments/sslcommerz/ipn`,
    shipping_method: 'NO',
    product_name: payload.courseTitle,
    product_category: 'Online Course',
    product_profile: 'general',
    cus_name: payload.studentName || 'Student',
    cus_email: payload.studentEmail || 'student@example.com',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_country: 'Bangladesh',
    cus_phone: payload.studentPhone || '01700000000',
  });

  try {
    const response = await axios.post(initUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data?.status === 'SUCCESS' && response.data?.GatewayPageURL) {
      return response.data.GatewayPageURL;
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      response.data?.failedreason || 'Failed to initiate SSLCommerz payment session',
    );
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `SSLCommerz Gateway Error: ${error?.message || 'Network error'}`,
    );
  }
};

const validatePayment = async (valId: string): Promise<ISSLCommerzValidationResponse> => {
  const baseUrl = getBaseUrl();
  const validationUrl = `${baseUrl}/validator/api/validationserverAPI.php`;

  try {
    const response = await axios.get<ISSLCommerzValidationResponse>(validationUrl, {
      params: {
        val_id: valId,
        store_id: config.sslcommerz.store_id,
        store_passwd: config.sslcommerz.store_password,
        v: 1,
        format: 'json',
      },
    });

    return response.data;
  } catch (error: any) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `SSLCommerz Validation Error: ${error?.message || 'Verification service unreachable'}`,
    );
  }
};

export const SSLCommerzServices = {
  initiateSession,
  validatePayment,
};
