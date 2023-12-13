//
//  MultiplayerService+GKMatchDelegate.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 12/10/23.
// 


import Foundation
import GameKit
import SwiftUI

extension MultiplayerService: GKMatchDelegate {
    func match(_ match: GKMatch, player: GKPlayer, didChange state: GKPlayerConnectionState) {
        switch state {
        case .connected:
            print("\(player.displayName) Connected")
            
            if match.expectedPlayerCount == 0 {
                self.player1 = match.players[0]
                self.player2 = match.players[1]
                
                self.player1?.loadPhoto(for: GKPlayer.PhotoSize.small) { (image, error) in
                    if let image {
                        #if os(iOS)
                        self.player1Avatar = Image(uiImage: image)
                        #else
                        self.player1Avatar = Image(nsImage: image)
                        #endif
                    }
                    if let error {
                        print("Error: \(error.localizedDescription)")
                    }
                }
                self.player2?.loadPhoto(for: GKPlayer.PhotoSize.small) { (image, error) in
                    if let image {
                        #if os(iOS)
                        self.player2Avatar = Image(uiImage: image)
                        #else
                        self.player2Avatar = Image(nsImage: image)
                        #endif
                    }
                    if let error {
                        print("Error: \(error.localizedDescription)")
                    }
                }
            }
        case .disconnected:
            print("\(player.displayName) Disconnected")
        default:
            print("\(player.displayName) Connection Unknown")
        }
    }
    
    func match(_ match: GKMatch, shouldReinviteDisconnectedPlayer player: GKPlayer) -> Bool {
        return true
    }
    
    func match(_ match: GKMatch, didReceive data: Data, fromRemotePlayer player: GKPlayer) {
        let gameData = self.decode(matchData: data)
    }
}
