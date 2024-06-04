import React, {
  useContext,
  createContext,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import {
  BuildType,
  type AuthDetails,
  type ExecuteRawTransaction,
  type ExecuteRawTransactionData,
  type NetworkData,
  type NftOrderDetails,
  type NftOrderDetailsData,
  type NftOrderDetailsQuery,
  type OktoContextType,
  type Order,
  type OrderData,
  type OrderQuery,
  type PortfolioData,
  type RawTransactionStatus,
  type RawTransactionStatusData,
  type RawTransactionStatusQuery,
  type Theme,
  type TokensData,
  type TransferNft,
  type TransferNftData,
  type TransferTokens,
  type TransferTokensData,
  type User,
  type WalletData,
  type ApiResponse,
  OrderStatus,
} from "./types";
import axios from "axios";
import { getQueryString } from "./utils/query-helpers";
import { JOB_MAX_RETRY, JOB_RETRY_INTERVAL, baseUrls, defaultTheme } from "./constants";
const OktoContext = createContext<OktoContextType | null>(null);

export const OktoProvider = ({
  children,
  apiKey,
  buildType,
}: {
  children: ReactNode;
  apiKey: string;
  buildType: BuildType;
}) => {
  const baseUrl = useMemo(() => baseUrls[buildType], [buildType]);
  const [authDetails, setAuthDetails] = useState<AuthDetails | null>();
  const [theme, updateTheme] = useState<Theme>(defaultTheme);
  const isLoggedIn = useMemo(() => authDetails !== null, [authDetails]);
  const axiosInstance = useMemo(() => {
    const axiosInstanceTmp = axios.create({
      baseURL: `${baseUrl}/api`,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    // Request Interceptor to add Auth tokens to every request
    axiosInstanceTmp.interceptors.request.use(
      (config) => {
        if (authDetails?.authToken) {
          config.headers.Authorization = `Bearer ${authDetails.authToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle 401 errors
    axiosInstanceTmp.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response.status === 401) {
          try {
            const newAuthDetails = await refreshToken(); // Attempt to refresh token
            if (newAuthDetails) {
              // Update the Authorization header with the new access token
              originalRequest.headers.Authorization = `Bearer ${newAuthDetails.authToken}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            // Handle refresh token errors
            updateAuthDetails(null); // Clear auth details if refresh fails
            return Promise.reject(refreshError);
          }
        }
        // Return the Promise rejection if refresh didn't work or error is not due to 401
        return Promise.reject(error);
      }
    );

    return axiosInstanceTmp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, authDetails, baseUrl]);

  async function updateAuthDetails(authDetailsNew: AuthDetails | null) {
    setAuthDetails(authDetailsNew);
  }

  async function refreshToken(): Promise<AuthDetails | null> {
    if (authDetails) {
      try {
        const response = await axios.post(
          `${baseUrl}/api/v1/refresh_token`,
          {},
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${authDetails?.authToken}`,
              "x-refresh-authorization": `Bearer ${authDetails.refreshToken}`,
              "x-device-token": authDetails.deviceToken,
              "x-api-key": apiKey,
            },
          }
        );
        const authDetailsNew: AuthDetails = {
          authToken: response.data.data.auth_token,
          refreshToken: response.data.data.refresh_auth_token,
          deviceToken: response.data.data.device_token,
        };

        updateAuthDetails(authDetailsNew);
        console.log("Refresh token: ", "success");
        return authDetailsNew;
      } catch (error) {
        throw new Error("Failed to refresh token");
      }
    }
    return null;
  }

  async function authenticate(
    idToken: string,
    callback: (result: any, error: any) => void
  ) {
    if (!axiosInstance) {
      return callback(null, new Error("SDK is not initialized"));
    }

    idToken = idToken;

    try {
      const response = await axios.post(
        `${baseUrl}/api/v1/authenticate`,
        {
          id_token: idToken,
        },
        {
          headers: {
            Accept: "*/*",
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (
        response.status === 200 &&
        response.data &&
        response.data.status === "success"
      ) {
        //check if token in data then open pincode flow
        if (response.data.data.auth_token) {
          const authDetailsNew: AuthDetails = {
            authToken: response.data.data.auth_token,
            refreshToken: response.data.data.refresh_auth_token,
            deviceToken: response.data.data.device_token,
          };
          updateAuthDetails(authDetailsNew);
        }
        callback(response.data.data, null);
      } else {
        callback(null, new Error("Server responded with an error"));
      }
    } catch (error) {
      callback(null, error);
    }
  }

  async function makeGetRequest<T>(
    endpoint: string,
    queryUrl: string | null = null
  ): Promise<T> {
    if (!axiosInstance) {
      throw new Error("SDK is not initialized");
    }

    const url = queryUrl ? `${endpoint}?${queryUrl}` : endpoint;
    try {
      const response = await axiosInstance.get<ApiResponse<T>>(url);
      if (response.data.status === "success") {
        return response.data.data;
      } else {
        throw new Error("Server responded with an error");
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unknown error");
    }
  }

  async function makePostRequest<T>(
    endpoint: string,
    data: any = null
  ): Promise<T> {
    if (!axiosInstance) {
      throw new Error("SDK is not initialized");
    }

    try {
      const response = await axiosInstance.post<ApiResponse<T>>(endpoint, data);
      if (response.data.status === "success") {
        return response.data.data;
      } else {
        throw new Error("Server responded with an error");
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unknown error");
    }
  }

  async function getPortfolio(): Promise<PortfolioData> {
    return makeGetRequest<PortfolioData>("/v1/portfolio");
  }

  async function getSupportedTokens(): Promise<TokensData> {
    return makeGetRequest<TokensData>("/v1/supported/tokens");
  }

  async function getSupportedNetworks(): Promise<NetworkData> {
    return makeGetRequest<NetworkData>("/v1/supported/networks");
  }

  async function getUserDetails(): Promise<User> {
    return makeGetRequest<User>("/v1/user_from_token");
  }

  async function getWallets(): Promise<WalletData> {
    return makeGetRequest<WalletData>("/v1/widget/wallet");
  }

  async function orderHistory(query: Partial<OrderQuery>): Promise<OrderData> {
    const queryString = getQueryString(query);
    return makeGetRequest<OrderData>("/v1/orders", queryString);
  }

  async function getNftOrderDetails(
    query: Partial<NftOrderDetailsQuery>
  ): Promise<NftOrderDetailsData> {
    const queryString = getQueryString(query);
    return makeGetRequest<NftOrderDetailsData>(
      "/v1/nft/order_details",
      queryString
    );
  }

  async function getRawTransactionStatus(
    query: RawTransactionStatusQuery
  ): Promise<RawTransactionStatusData> {
    const queryString = getQueryString(query);
    return makeGetRequest<RawTransactionStatusData>(
      "/v1/rawtransaction/status",
      queryString
    );
  }

  async function createWallet(): Promise<WalletData> {
    return makePostRequest<WalletData>("/v1/wallet");
  }

  async function transferTokens(
    data: TransferTokens
  ): Promise<TransferTokensData> {
    return makePostRequest<TransferTokensData>(
      "/v1/transfer/tokens/execute",
      data
    );
  }

  async function transferTokensWithJobStatus(
    data: TransferTokens,
  ): Promise<Order> {
    try {
      const { orderId } = await transferTokens(data);
      console.log("Transfer tokens order ID", orderId);

      return await waitForJobCompletion<Order>(
        orderId,
        async (_orderId: string) => {
          const orderData = await orderHistory({ order_id: _orderId });
          const order = orderData.jobs.find(
            (item) => item.order_id === _orderId,
          );
          if (
            order &&
            (order.status === OrderStatus.SUCCESS ||
              order.status === OrderStatus.FAILED)
          ) {
            console.log("Found order: ", order);
            return order;
          }
          throw new Error(
            `Order with ID ${_orderId} not found or not completed.`,
          );
        },
      );
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unknown error");
    }
  }

  async function transferNft(data: TransferNft): Promise<TransferNftData> {
    return makePostRequest<TransferNftData>(
      "/v1/nft/transfer",
      data,
    );
  }

  async function transferNftWithJobStatus(
    data: TransferNft,
  ): Promise<NftOrderDetails> {
    try {
      const { order_id } = await transferNft(data);
      console.log("Transfer nfts order ID", order_id);

      return await waitForJobCompletion<NftOrderDetails>(
        order_id,
        async (orderId: string) => {
          const orderData = await getNftOrderDetails({
            order_id: orderId,
          });
          const order = orderData.nfts.find((item) => item.id === orderId);
          if (order) {
            console.log("Found order: ", order);
            return order;
          }
          throw new Error(
            `Order with ID ${orderId} not found or not completed.`,
          );
        },
      );
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unknown error");
    }
  }

  async function executeRawTransaction(
    data: ExecuteRawTransaction,
  ): Promise<ExecuteRawTransactionData> {
    return makePostRequest<ExecuteRawTransactionData>(
      "/v1/rawtransaction/execute",
      data,
    );
  }

  async function executeRawTransactionWithJobStatus(
    data: ExecuteRawTransaction,
  ): Promise<RawTransactionStatus> {
    try {
      const { jobId } = await executeRawTransaction(data);
      console.log("Execute Raw transaction called with Job ID", jobId);

      return await waitForJobCompletion<RawTransactionStatus>(
        jobId,
        async (orderId: string) => {
          const orderData = await getRawTransactionStatus({
            order_id: orderId,
          });
          const order = orderData.jobs.find(
            (item) => item.order_id === orderId,
          );
          if (
            order &&
            (order.status === OrderStatus.SUCCESS ||
              order.status === OrderStatus.FAILED)
          ) {
            console.log("Found order: ", order);
            return order;
          }
          throw new Error(
            `Order with ID ${orderId} not found or not completed.`,
          );
        },
      );
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unknown error");
    }
  }

  async function waitForJobCompletion<T>(
    orderId: string,
    findJobCallback: (orderId: string) => Promise<T>,
  ): Promise<T> {
    for (let retryCount = 0; retryCount < JOB_MAX_RETRY; retryCount++) {
      try {
        return await findJobCallback(orderId);
      } catch (error) {
        console.log("Waiting for order completion:", error);
      }
      await delay(JOB_RETRY_INTERVAL);
    }
    throw new Error(
      `Order with ID ${orderId} not found or not completed after ${JOB_MAX_RETRY * (JOB_RETRY_INTERVAL / 1000)} seconds. Returning failure.`,
    );
  }

  async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function logOut() {
    updateAuthDetails(null);
  }

  function setTheme(newTheme: Partial<Theme>) {
    updateTheme({ ...theme, ...newTheme });
  }

  function getTheme(): Theme {
    return theme;
  }

  return (
    <OktoContext.Provider
      value={{
        isLoggedIn,
        authenticate,
        logOut,
        getPortfolio,
        getSupportedNetworks,
        getSupportedTokens,
        getUserDetails,
        getWallets,
        orderHistory,
        getNftOrderDetails,
        getRawTransactionStatus,
        createWallet,
        transferNft,
        transferNftWithJobStatus,
        transferTokens,
        transferTokensWithJobStatus,
        executeRawTransaction,
        executeRawTransactionWithJobStatus,
        setTheme,
        getTheme,
      }}
    >
      {children}
    </OktoContext.Provider>
  );
};

export const useOkto = () => useContext(OktoContext);
