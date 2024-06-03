import React, { useMemo, useState } from "react";
import axios from "axios";
import * as Types from "./types";
import { BuildType, AuthDetails } from "./types";

export const baseUrls = {
  [BuildType.PRODUCTION]: "https://apigw.okto.tech",
  [BuildType.STAGING]: "https://3p-bff.oktostage.com",
  [BuildType.SANDBOX]: "https://sandbox-api.okto.tech",
};

export function useOkto(apiKey: string, buildType: BuildType) {
  const baseUrl = useMemo(() => baseUrls[buildType], [buildType]);
  const [authDetails, setAuthDetails] = useState<AuthDetails | null>();
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
  const isLoggedIn = useMemo(() => authDetails, [authDetails]);

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
      const response = await axiosInstance.get(url);
      if (response.data.status === "success") {
        return response.data.data;
      } else {
        throw new Error("Server responded with an error");
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unknown error");
    }
  }

  async function getPortfolio(): Promise<Types.PortfolioData> {
    return makeGetRequest<Types.PortfolioData>("/v1/portfolio");
  }

  async function getWallets(): Promise<Types.WalletData> {
    return makeGetRequest<Types.WalletData>("/v1/widget/wallet");
  }

  async function makePostRequest<T>(endpoint: string, data: any = null): Promise<T> {
    if (!axiosInstance) {
      throw new Error("SDK is not initialized");
    }

    try {
      const response = await axiosInstance.post<Types.ApiResponse<T>>(
        endpoint,
        data,
      );
      if (response.data.status === "success") {
        return response.data.data;
      } else {
        throw new Error("Server responded with an error");
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unknown error");
    }
  }

  async function createWallet(): Promise<Types.WalletData> {
    return makePostRequest<Types.WalletData>("/v1/wallet");
  }

  async function transferTokens(
    data: Types.TransferTokens,
  ): Promise<Types.TransferTokensData> {
    return makePostRequest<Types.TransferTokensData>(
      "/v1/transfer/tokens/execute",
      data,
    );
  }

  async function logOut() {
    updateAuthDetails(null);
  }

  return {
    authenticate,
    logOut,
    isLoggedIn,
    getPortfolio,
    transferTokens,
    getWallets,
    createWallet
  };
}
