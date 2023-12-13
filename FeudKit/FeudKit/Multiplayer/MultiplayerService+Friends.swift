//
//  MultiplayerService+Friends.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 12/10/23.
//

import Foundation
import GameKit

public struct Friend: Identifiable {
    public var id = UUID()
    public var player: GKPlayer
}

public extension MultiplayerService {
    func addFriends() {
        
    }
    
    func accessFriends() async {
        do {
            let authorizationStatus = try await GKLocalPlayer.local.loadFriendsAuthorizationStatus()
            
            let loadFriendsClosure: ([GKPlayer]) -> Void = { [self] players in
                for player in players {
                    let friend = Friend(player: player)
                    self.friends.append(friend)
                }
            }
            
            switch authorizationStatus {
            case .notDetermined, .authorized:
                let players = try await GKLocalPlayer.local.loadFriends()
                loadFriendsClosure(players)
            case .restricted:
                print("authorizationStatus: restricted")
            case .denied:
                print("authorizationStatus: denied")
            @unknown default:
                print("authroizationStatus: unknown")
            }
        } catch {
            print("Error: \(error.localizedDescription)")
        }
    }
}
