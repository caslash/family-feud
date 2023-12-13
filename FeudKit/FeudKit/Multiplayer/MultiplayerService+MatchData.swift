//
//  MultiplayerService+MatchData.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 12/11/23.
//

import Foundation
import GameKit
import SwiftUI

struct GameData: Codable {
    var matchName: String
    var playerName: String
}

extension MultiplayerService {
    func encode(gameData: GameData) -> Data? {
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .xml
        
        do {
            let data = try encoder.encode(gameData)
            return data
        } catch {
            print("Error: \(error.localizedDescription)")
            return nil
        }
    }
    
    func decode(matchData: Data) -> GameData? {
        return try? PropertyListDecoder().decode(GameData.self, from: matchData)
    }
}
